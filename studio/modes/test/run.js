#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  createModeRegistry,
  listModes,
  enableMode,
  activeMode,
  assertFalsifier,
  listRailProfiles,
  evaluateRun,
  evaluateFile,
  REGISTRY_CODES,
  RAILS,
} = require("..");

let passed = 0;
let failed = 0;

function pass(name) {
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function fail(name, detail) {
  failed += 1;
  process.stderr.write(`FAIL ${name}: ${detail}\n`);
}

function runCase(name, fn) {
  try {
    const result = fn();
    if (result && result.ok === false) {
      fail(name, result.error || "ok=false");
      return;
    }
    pass(name);
  } catch (err) {
    fail(name, err && err.message ? err.message : String(err));
  }
}

function expectReject(result, code) {
  if (!result || result.ok !== false || result.code !== code) {
    return {
      ok: false,
      error: `expected ${code}, got ${result && result.ok ? "ok" : result && result.code} ${result && result.detail ? result.detail : ""}`.trim(),
    };
  }
  if (result.verdict !== null || result.clock_started !== false) {
    return { ok: false, error: "reject must pin verdict=null clock_started=false" };
  }
  return { ok: true };
}

function expectOk(result) {
  if (!result || result.ok !== true) {
    return {
      ok: false,
      error: `expected ok, got ${result && result.code} ${result && result.detail ? result.detail : ""}`.trim(),
    };
  }
  if (result.verdict !== null || result.clock_started !== false) {
    return { ok: false, error: "ok must pin verdict=null clock_started=false" };
  }
  return { ok: true, data: result.data };
}

function overlapMode(id, fences, plantedFile) {
  return {
    id,
    rail: "multi-lane-awareness",
    falsifier: "Injected mode used to prove enable collision.",
    fences,
    planted: {
      file: plantedFile || "fixtures/planted/lane-collision.json",
      expect_code: "LANE_COLLISION",
    },
  };
}

function cases() {
  runCase("listModes returns the three shipped rails", () => {
    const listed = expectOk(createModeRegistry().listModes());
    if (!listed.ok) return listed;
    const ids = listed.data.modes.map((row) => row.id);
    if (JSON.stringify(ids) !== JSON.stringify(["eng-coding", "no-self-cert", "research-before-claim"])) {
      return { ok: false, error: `ids=${ids.join(",")}` };
    }
    return { ok: true };
  });

  runCase("each shipped mode has a falsifier string and lane fences", () => {
    const listed = expectOk(createModeRegistry().listModes());
    if (!listed.ok) return listed;
    for (const row of listed.data.modes) {
      if (typeof row.falsifier !== "string" || !row.falsifier.trim()) {
        return { ok: false, error: `${row.id} falsifier` };
      }
      if (!Array.isArray(row.fences) || row.fences.length === 0) {
        return { ok: false, error: `${row.id} fences` };
      }
      if (!RAILS.includes(row.rail)) {
        return { ok: false, error: `${row.id} rail ${row.rail}` };
      }
      if (row.enabled !== false) {
        return { ok: false, error: `${row.id} should start disabled` };
      }
    }
    return { ok: true };
  });

  runCase("enableMode then activeMode returns that mode", () => {
    const session = createModeRegistry();
    const enabled = expectOk(session.enableMode("eng-coding"));
    if (!enabled.ok) return enabled;
    if (enabled.data.mode.id !== "eng-coding" || enabled.data.mode.enabled !== true) {
      return { ok: false, error: JSON.stringify(enabled.data) };
    }
    const active = expectOk(session.activeMode());
    if (!active.ok) return active;
    if (!active.data.mode || active.data.mode.id !== "eng-coding") {
      return { ok: false, error: JSON.stringify(active.data) };
    }
    return { ok: true };
  });

  runCase("the three shipped modes enable together", () => {
    const session = createModeRegistry();
    for (const id of ["eng-coding", "research-before-claim", "no-self-cert"]) {
      const enabled = expectOk(session.enableMode(id));
      if (!enabled.ok) return enabled;
    }
    const listed = expectOk(session.listModes());
    if (!listed.ok) return listed;
    const on = listed.data.modes.filter((row) => row.enabled).map((row) => row.id);
    if (on.join(" ") !== "eng-coding no-self-cert research-before-claim") {
      return { ok: false, error: `enabled=${on.join(",")}` };
    }
    return { ok: true };
  });

  runCase("re-enable is idempotent and keeps activeMode", () => {
    const session = createModeRegistry();
    session.enableMode("no-self-cert");
    const again = expectOk(session.enableMode("no-self-cert"));
    if (!again.ok) return again;
    const active = expectOk(session.activeMode());
    if (!active.ok) return active;
    if (active.data.mode.id !== "no-self-cert") {
      return { ok: false, error: JSON.stringify(active.data) };
    }
    const listed = expectOk(session.listModes());
    if (!listed.ok) return listed;
    const on = listed.data.modes.filter((row) => row.enabled).map((row) => row.id);
    if (on.join(" ") !== "no-self-cert") {
      return { ok: false, error: `enabled=${on.join(",")}` };
    }
    return { ok: true };
  });

  runCase("unknown mode returns UNKNOWN_MODE", () => {
    return expectReject(createModeRegistry().enableMode("waiting-home"), "UNKNOWN_MODE");
  });

  runCase("empty id returns BAD_ARGUMENT", () => {
    const empty = expectReject(createModeRegistry().enableMode(""), "BAD_ARGUMENT");
    if (!empty.ok) return empty;
    return expectReject(createModeRegistry().assertFalsifier("   "), "BAD_ARGUMENT");
  });

  runCase("life-OS ids return LIFE_OS_DENIED", () => {
    const session = createModeRegistry();
    const food = expectReject(session.enableMode("life.food"), "LIFE_OS_DENIED");
    if (!food.ok) return food;
    return expectReject(session.assertFalsifier("life-flights"), "LIFE_OS_DENIED");
  });

  runCase("overlapping fences return LANE_COLLISION and leave the first active", () => {
    const session = createModeRegistry({ extra: [overlapMode("overlap-coding", ["studio/modes/"])] });
    const first = expectOk(session.enableMode("eng-coding"));
    if (!first.ok) return first;
    const second = expectReject(session.enableMode("overlap-coding"), "LANE_COLLISION");
    if (!second.ok) return second;
    const active = expectOk(session.activeMode());
    if (!active.ok) return active;
    if (active.data.mode.id !== "eng-coding") {
      return { ok: false, error: `active=${active.data.mode && active.data.mode.id}` };
    }
    const listed = expectOk(session.listModes());
    if (!listed.ok) return listed;
    const overlap = listed.data.modes.find((row) => row.id === "overlap-coding");
    if (!overlap || overlap.enabled) {
      return { ok: false, error: "overlap-coding was marked enabled after collision" };
    }
    return { ok: true };
  });

  runCase("nested fence prefixes collide", () => {
    const session = createModeRegistry({
      extra: [overlapMode("nested-modes", ["studio/modes/catalog/"])],
    });
    const first = expectOk(session.enableMode("eng-coding"));
    if (!first.ok) return first;
    const second = expectReject(session.enableMode("nested-modes"), "LANE_COLLISION");
    if (!second.ok) return second;
    const active = expectOk(session.activeMode());
    if (!active.ok) return active;
    if (active.data.mode.id !== "eng-coding") {
      return { ok: false, error: `active=${active.data.mode && active.data.mode.id}` };
    }
    const listed = expectOk(session.listModes());
    if (!listed.ok) return listed;
    const nested = listed.data.modes.find((row) => row.id === "nested-modes");
    if (!nested || nested.enabled) {
      return { ok: false, error: "nested-modes was marked enabled after collision" };
    }
    return { ok: true };
  });

  runCase("wider fence after a nested fence also collides", () => {
    const session = createModeRegistry({
      extra: [overlapMode("nested-modes", ["studio/modes/catalog/"])],
    });
    const first = expectOk(session.enableMode("nested-modes"));
    if (!first.ok) return first;
    const second = expectReject(session.enableMode("eng-coding"), "LANE_COLLISION");
    if (!second.ok) return second;
    const active = expectOk(session.activeMode());
    if (!active.ok) return active;
    if (active.data.mode.id !== "nested-modes") {
      return { ok: false, error: `active=${active.data.mode && active.data.mode.id}` };
    }
    const listed = expectOk(session.listModes());
    if (!listed.ok) return listed;
    const coding = listed.data.modes.find((row) => row.id === "eng-coding");
    if (!coding || coding.enabled) {
      return { ok: false, error: "eng-coding was marked enabled after reverse-nest collision" };
    }
    return { ok: true };
  });

  runCase("a multi-fence mode collides when only one fence overlaps", () => {
    const session = createModeRegistry({
      extra: [overlapMode("split-lane", ["studio/github/", "studio/modes/catalog/"])],
    });
    const first = expectOk(session.enableMode("eng-coding"));
    if (!first.ok) return first;
    return expectReject(session.enableMode("split-lane"), "LANE_COLLISION");
  });

  runCase("a sibling still enables after a collision", () => {
    const session = createModeRegistry({
      extra: [
        overlapMode("overlap-coding", ["studio/modes/"]),
        overlapMode("github-lane", ["studio/github/"]),
      ],
    });
    session.enableMode("eng-coding");
    const blocked = expectReject(session.enableMode("overlap-coding"), "LANE_COLLISION");
    if (!blocked.ok) return blocked;
    const sibling = expectOk(session.enableMode("github-lane"));
    if (!sibling.ok) return sibling;
    const listed = expectOk(session.listModes());
    if (!listed.ok) return listed;
    const on = listed.data.modes.filter((row) => row.enabled).map((row) => row.id);
    if (on.join(" ") !== "eng-coding github-lane") {
      return { ok: false, error: `enabled=${on.join(",")}` };
    }
    return { ok: true };
  });

  runCase("sibling fences do not collide", () => {
    const session = createModeRegistry({
      extra: [overlapMode("github-lane", ["studio/github/"])],
    });
    const first = expectOk(session.enableMode("eng-coding"));
    if (!first.ok) return first;
    return expectOk(session.enableMode("github-lane"));
  });

  function assertPlantedBite(id, code, file) {
    const proof = expectOk(createModeRegistry().assertFalsifier(id));
    if (!proof.ok) return proof;
    if (proof.data.code !== code) {
      return { ok: false, error: `code=${proof.data.code}` };
    }
    if (proof.data.file !== file) {
      return { ok: false, error: `file=${proof.data.file}` };
    }
    const report = evaluateFile(path.join(__dirname, "..", file));
    const codes = report.violations.map((row) => row.code);
    if (report.ok || !codes.includes(code)) {
      return { ok: false, error: `independent grade of ${file} was [${codes.join(",") || "none"}]` };
    }
    return { ok: true };
  }

  runCase("assertFalsifier eng-coding trips LANE_COLLISION", () => {
    const bite = assertPlantedBite("eng-coding", "LANE_COLLISION", "fixtures/planted/lane-collision.json");
    if (!bite.ok) return bite;
    const proof = expectOk(createModeRegistry().assertFalsifier("eng-coding"));
    if (!proof.ok) return proof;
    if (proof.data.falsifier !== "A coding run that edits studio/shell/ trips LANE_COLLISION.") {
      return { ok: false, error: proof.data.falsifier };
    }
    return { ok: true };
  });

  runCase("assertFalsifier research-before-claim trips NO_EVIDENCE", () => {
    return assertPlantedBite(
      "research-before-claim",
      "NO_EVIDENCE",
      "fixtures/planted/skip-research.json"
    );
  });

  runCase("assertFalsifier no-self-cert trips SELF_CERT_VERDICT", () => {
    return assertPlantedBite("no-self-cert", "SELF_CERT_VERDICT", "fixtures/planted/self-cert-verdict.json");
  });

  runCase("assertFalsifier misses when the planted record is clean", () => {
    const session = createModeRegistry({
      extra: [
        {
          id: "false-proof",
          rail: "no-self-cert",
          falsifier: "Should miss because the good fixture does not self-cert.",
          fences: ["studio/github/"],
          planted: { file: "fixtures/good/eng-studio-d.json", expect_code: "SELF_CERT_VERDICT" },
        },
      ],
    });
    return expectReject(session.assertFalsifier("false-proof"), "FALSIFIER_MISSED");
  });

  runCase("two registries do not share enabled state", () => {
    const a = createModeRegistry();
    const b = createModeRegistry();
    a.enableMode("eng-coding");
    const active = expectOk(b.activeMode());
    if (!active.ok) return active;
    if (active.data.mode !== null) {
      return { ok: false, error: "shared mutable registry" };
    }
    return { ok: true };
  });

  runCase("module-level listModes is the product catalog", () => {
    const listed = expectOk(listModes());
    if (!listed.ok) return listed;
    const ids = listed.data.modes.map((row) => row.id);
    if (!ids.includes("eng-coding") || !ids.includes("research-before-claim") || !ids.includes("no-self-cert")) {
      return { ok: false, error: ids.join(",") };
    }
    const profiles = listRailProfiles();
    if (JSON.stringify(profiles) !== JSON.stringify(["design", "eng"])) {
      return { ok: false, error: `rail profiles ${profiles.join(",")}` };
    }
    return { ok: true };
  });

  runCase("module-level enableMode and assertFalsifier exist", () => {
    if (typeof enableMode !== "function" || typeof activeMode !== "function" || typeof assertFalsifier !== "function") {
      return { ok: false, error: "missing module-level registry API" };
    }
    const unknown = expectReject(enableMode("not-a-mode"), "UNKNOWN_MODE");
    if (!unknown.ok) return unknown;
    return { ok: true };
  });

  runCase("life-OS catalog rows throw at parse", () => {
    try {
      createModeRegistry({
        extra: [
          {
            id: "life.food",
            rail: "no-self-cert",
            falsifier: "Life-OS must not load.",
            fences: ["studio/github/"],
            planted: { file: "fixtures/planted/self-cert-verdict.json", expect_code: "SELF_CERT_VERDICT" },
          },
        ],
      });
    } catch (err) {
      if (/life-OS/.test(err.message)) return { ok: true };
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "life.food catalog row was accepted" };
  });

  runCase("REGISTRY_CODES is a closed set that includes LANE_COLLISION", () => {
    const need = ["LANE_COLLISION", "FALSIFIER_MISSED", "LIFE_OS_DENIED"];
    const missing = need.filter((code) => !REGISTRY_CODES.includes(code));
    if (missing.length) {
      return { ok: false, error: `missing ${missing.join(",")} in ${REGISTRY_CODES.join(",")}` };
    }
    return { ok: true };
  });

  runCase("planted lane-collision still grades as a rail violation", () => {
    const report = evaluateRun(require(path.join(__dirname, "..", "fixtures", "planted", "lane-collision.json")));
    const codes = report.violations.map((row) => row.code);
    if (report.ok || !codes.includes("LANE_COLLISION")) {
      return { ok: false, error: JSON.stringify(codes) };
    }
    return { ok: true };
  });
}

cases();
process.stdout.write(
  `studio/modes registry ${passed} passed, ${failed} failed; verdict=null; clock_started=false\n`
);
process.exit(failed ? 1 : 0);
