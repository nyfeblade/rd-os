"use strict";

/**
 * The three mode rails, as pure functions over a lane run record.
 * Each rail returns an array of violations; an empty array is the only pass.
 * No rail reads the filesystem and no rail writes a verdict.
 */

const VIOLATION_CODES = [
  // rail: research-before-claim
  "NO_CLAIMS",
  "NO_EVIDENCE",
  "UNNAMED_EVIDENCE",
  "UNKNOWN_EVIDENCE_KIND",
  "UNMEASURED_EVIDENCE",
  "NO_KILL_LINE",
  // rail: multi-lane-awareness
  "NO_FENCE",
  "FENCE_OVERLAP",
  "FENCE_ESCAPE",
  "LANE_COLLISION",
  // rail: no-self-cert
  "SELF_CERT_VERDICT",
  "SELF_CERT_CLAIM",
  "CLOCK_STARTED_FORBIDDEN",
];

const RAILS = ["research-before-claim", "multi-lane-awareness", "no-self-cert"];

function violation(rail, code, where, detail) {
  if (!VIOLATION_CODES.includes(code)) {
    throw new Error(`violation code not in closed set: ${code}`);
  }
  return { rail, code, where, detail };
}

function normalizePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

/** Prefix match on segment boundaries: "studio/modes/" covers "studio/modes/x" but not "studio/modeshift". */
function underPrefix(filePath, prefix) {
  const p = normalizePath(filePath);
  const base = normalizePath(prefix).replace(/\/+$/, "");
  if (!base) return false;
  return p === base || p.startsWith(`${base}/`);
}

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

/**
 * Rail 1 — research-before-claim.
 * A claim is a debt until it names evidence a stranger can re-open, and says what would kill it.
 */
function researchBeforeClaim(run, mode) {
  const out = [];
  const claims = Array.isArray(run.claims) ? run.claims : [];
  if (claims.length === 0) {
    return [violation("research-before-claim", "NO_CLAIMS", "claims", "run record states no claims")];
  }

  const measured = new Map();
  for (const row of Array.isArray(run.commands) ? run.commands : []) {
    if (row && !isBlank(row.cmd) && Number.isInteger(row.exit_code)) {
      measured.set(row.cmd.trim(), row.exit_code);
    }
  }

  const minEvidence = Number.isInteger(mode.min_evidence) ? mode.min_evidence : 1;
  const kinds = Array.isArray(mode.evidence_kinds) ? mode.evidence_kinds : [];

  claims.forEach((claim, i) => {
    const where = `claims[${i}]${claim && claim.id ? ` (${claim.id})` : ""}`;
    const evidence = Array.isArray(claim && claim.evidence) ? claim.evidence : [];

    if (evidence.length < minEvidence) {
      out.push(
        violation(
          "research-before-claim",
          "NO_EVIDENCE",
          where,
          `needs >=${minEvidence} evidence entries, has ${evidence.length}`
        )
      );
    }

    evidence.forEach((item, j) => {
      const at = `${where}.evidence[${j}]`;
      if (!item || isBlank(item.ref)) {
        out.push(violation("research-before-claim", "UNNAMED_EVIDENCE", at, "evidence.ref is empty"));
        return;
      }
      if (!kinds.includes(item.kind)) {
        out.push(
          violation(
            "research-before-claim",
            "UNKNOWN_EVIDENCE_KIND",
            at,
            `kind=${JSON.stringify(item.kind)} not in ${kinds.join("|")}`
          )
        );
        return;
      }
      if (item.kind === "command" && !measured.has(item.ref.trim())) {
        out.push(
          violation(
            "research-before-claim",
            "UNMEASURED_EVIDENCE",
            at,
            `command "${item.ref}" has no recorded exit_code in run.commands`
          )
        );
      }
    });

    if (mode.require_measured_evidence) {
      const hasMeasured = evidence.some(
        (item) => item && item.kind === "command" && !isBlank(item.ref) && measured.has(item.ref.trim())
      );
      if (!hasMeasured) {
        out.push(
          violation(
            "research-before-claim",
            "UNMEASURED_EVIDENCE",
            where,
            "mode requires at least one measured command per claim"
          )
        );
      }
    }

    if (mode.require_kill_line && isBlank(claim && claim.kill)) {
      out.push(violation("research-before-claim", "NO_KILL_LINE", where, "claim states nothing that would falsify it"));
    }
  });

  return out;
}

/**
 * Rail 2 — multi-lane awareness.
 * The fence comes from the registry, not from the lane. A lane that cannot be placed has no fence.
 */
function multiLaneAwareness(run, mode, lanes) {
  const out = [];
  const registry = (lanes && lanes.lanes) || {};
  const laneId = run.lane;
  const entry = laneId && Object.prototype.hasOwnProperty.call(registry, laneId) ? registry[laneId] : null;

  if (!entry || !Array.isArray(entry.owns) || entry.owns.length === 0) {
    return [
      violation(
        "multi-lane-awareness",
        "NO_FENCE",
        "lane",
        `lane ${JSON.stringify(laneId)} is not in the lane registry; no owned paths to fence against`
      ),
    ];
  }

  const owns = entry.owns.map(normalizePath);
  const foreign = [];
  for (const [id, row] of Object.entries(registry)) {
    if (id === laneId || !row || !Array.isArray(row.owns)) continue;
    for (const prefix of row.owns) foreign.push({ lane: id, prefix: normalizePath(prefix) });
  }

  // A lane may declare a narrower fence than it owns, never a wider one.
  const declared = Array.isArray(run.fence && run.fence.allow) ? run.fence.allow : [];
  declared.forEach((prefix, i) => {
    if (!owns.some((owned) => underPrefix(prefix, owned))) {
      out.push(
        violation(
          "multi-lane-awareness",
          "FENCE_OVERLAP",
          `fence.allow[${i}]`,
          `${normalizePath(prefix)} is not inside ${laneId}'s owned paths (${owns.join(", ")})`
        )
      );
    }
  });

  const allow = declared.length ? declared.map(normalizePath) : owns;
  const touched = Array.isArray(run.touched_paths) ? run.touched_paths : [];
  touched.forEach((raw, i) => {
    const p = normalizePath(raw);
    const collision = foreign.find((row) => underPrefix(p, row.prefix));
    if (collision) {
      out.push(
        violation(
          "multi-lane-awareness",
          "LANE_COLLISION",
          `touched_paths[${i}]`,
          `${p} is owned by lane ${collision.lane} (${collision.prefix})`
        )
      );
      return;
    }
    if (!allow.some((prefix) => underPrefix(p, prefix))) {
      out.push(
        violation(
          "multi-lane-awareness",
          "FENCE_ESCAPE",
          `touched_paths[${i}]`,
          `${p} is outside the declared fence (${allow.join(", ")})`
        )
      );
    }
  });

  return out;
}

/**
 * Rail 3 — no self-cert.
 * The verdict belongs to a proof seat and the clock belongs to the kill harness. A lane reports measurements.
 */
function noSelfCert(run, mode) {
  const out = [];

  if (run.verdict !== null && run.verdict !== undefined) {
    out.push(
      violation(
        "no-self-cert",
        "SELF_CERT_VERDICT",
        "verdict",
        `verdict is reserved for the proof seat; run record wrote ${JSON.stringify(run.verdict)}`
      )
    );
  }

  if (run.clock_started === true) {
    out.push(violation("no-self-cert", "CLOCK_STARTED_FORBIDDEN", "clock_started", "a lane run cannot arm the clock"));
  }

  const words = Array.isArray(mode.verdict_words) ? mode.verdict_words : [];
  const claims = Array.isArray(run.claims) ? run.claims : [];
  claims.forEach((claim, i) => {
    const where = `claims[${i}]${claim && claim.id ? ` (${claim.id})` : ""}`;
    const text = String((claim && claim.text) || "");
    const hit = words.find((word) => wordPresent(text, word));
    if (hit) {
      out.push(
        violation(
          "no-self-cert",
          "SELF_CERT_CLAIM",
          where,
          `claim grades itself with "${hit}"; state the measurement instead`
        )
      );
    }
    if (claim && claim.verdict !== undefined && claim.verdict !== null) {
      out.push(violation("no-self-cert", "SELF_CERT_VERDICT", where, "claims do not carry verdicts"));
    }
  });

  return out;
}

function wordPresent(text, word) {
  const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9-])${escaped}([^A-Za-z0-9-]|$)`, "i").test(text);
}

module.exports = {
  RAILS,
  VIOLATION_CODES,
  researchBeforeClaim,
  multiLaneAwareness,
  noSelfCert,
  normalizePath,
  underPrefix,
};
