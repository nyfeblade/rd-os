#!/usr/bin/env node
"use strict";

const {
  createHitlKernel,
  HIGH_RISK_KINDS,
  HUMAN_ACTOR,
} = require("..");

function fresh(opts) {
  return createHitlKernel(opts || {});
}

function runCase(name, fn) {
  try {
    const result = fn();
    if (result && result.ok === false && result.error) {
      return { name, ok: false, detail: result.error };
    }
    return { name, ok: true };
  } catch (err) {
    return { name, ok: false, detail: err && err.message ? err.message : String(err) };
  }
}

function expectOk(result) {
  if (!result || result.ok !== true) {
    return {
      ok: false,
      error: `expected ok, got ${result && result.code} ${result && result.detail ? result.detail : ""}`.trim(),
    };
  }
  return { ok: true, data: result.data };
}

function expectReject(result, code) {
  if (!result || result.ok !== false || result.code !== code) {
    return {
      ok: false,
      error: `expected ${code}, got ${result && result.ok ? "ok" : result && result.code}`.trim(),
    };
  }
  return { ok: true };
}

function cases() {
  const rows = [];

  rows.push(
    runCase("create merge gate → need_you true, status open, risk high", () => {
      const kernel = fresh({ ids: { next: () => "gate_1" } });
      const created = expectOk(
        kernel.createGate({
          kind: "merge",
          title: "Merge PR 12",
          payload_summary: "merge #12 into main",
        })
      );
      if (!created.ok) {
        return created;
      }
      const gate = created.data.gate;
      if (
        gate.id !== "gate_1" ||
        gate.kind !== "merge" ||
        gate.title !== "Merge PR 12" ||
        gate.need_you !== true ||
        gate.risk !== "high" ||
        gate.payload_summary !== "merge #12 into main" ||
        gate.status !== "open"
      ) {
        return { ok: false, error: JSON.stringify(gate) };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("listNeedYou returns only open gates", () => {
      let n = 0;
      const kernel = fresh({ ids: { next: () => `gate_${++n}` } });
      kernel.createGate({ kind: "deploy", title: "Promote prod" });
      kernel.createGate({ kind: "db", title: "Drop staging" });
      const listed = expectOk(kernel.listNeedYou());
      if (!listed.ok) {
        return listed;
      }
      if (listed.data.gates.length !== 2) {
        return { ok: false, error: `count=${listed.data.gates.length}` };
      }
      if (listed.data.gates.some((gate) => gate.need_you !== true || gate.status !== "open")) {
        return { ok: false, error: JSON.stringify(listed.data.gates) };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("approve transition clears need_you", () => {
      const kernel = fresh({ ids: { next: () => "gate_a" } });
      kernel.createGate({ kind: "public_post", title: "Release notes blast" });
      const resolved = expectOk(
        kernel.resolveGate({ id: "gate_a", decision: "approve", actor: HUMAN_ACTOR })
      );
      if (!resolved.ok) {
        return resolved;
      }
      const gate = resolved.data.gate;
      if (gate.status !== "approved" || gate.need_you !== false) {
        return { ok: false, error: JSON.stringify(gate) };
      }
      const listed = expectOk(kernel.listNeedYou());
      if (!listed.ok) {
        return listed;
      }
      if (listed.data.gates.length !== 0) {
        return { ok: false, error: "approved gate still in need-you" };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("reject transition clears need_you", () => {
      const kernel = fresh({ ids: { next: () => "gate_r" } });
      kernel.createGate({ kind: "merge", title: "Land hotfix" });
      const resolved = expectOk(
        kernel.resolveGate({ id: "gate_r", decision: "reject", actor: HUMAN_ACTOR })
      );
      if (!resolved.ok) {
        return resolved;
      }
      if (resolved.data.gate.status !== "rejected" || resolved.data.gate.need_you !== false) {
        return { ok: false, error: JSON.stringify(resolved.data.gate) };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("defer transition clears need_you", () => {
      const kernel = fresh({ ids: { next: () => "gate_d" } });
      kernel.createGate({ kind: "deploy", title: "Friday ship" });
      const resolved = expectOk(
        kernel.resolveGate({ id: "gate_d", decision: "defer", actor: HUMAN_ACTOR })
      );
      if (!resolved.ok) {
        return resolved;
      }
      if (resolved.data.gate.status !== "deferred" || resolved.data.gate.need_you !== false) {
        return { ok: false, error: JSON.stringify(resolved.data.gate) };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("create cannot silently approve", () => {
      const kernel = fresh();
      const blocked = expectReject(
        kernel.createGate({ kind: "merge", title: "x", status: "approved" }),
        "AUTO_APPROVE_FORBIDDEN"
      );
      if (!blocked.ok) {
        return blocked;
      }
      return expectReject(
        kernel.createGate({ kind: "deploy", title: "y", auto_approve: true }),
        "AUTO_APPROVE_FORBIDDEN"
      );
    })
  );

  HIGH_RISK_KINDS.forEach((kind) => {
    rows.push(
      runCase(`high-risk ${kind} rejects merge/deploy/public/system actors`, () => {
        const kernel = fresh({ ids: { next: () => `gate_${kind}` } });
        kernel.createGate({ kind, title: `${kind} write` });
        const actors = ["merge", "deploy", "db", "public", "public_post", "system", "auto", "bot"];
        for (const actor of actors) {
          const blocked = expectReject(
            kernel.resolveGate({ id: `gate_${kind}`, decision: "approve", actor }),
            "HUMAN_REQUIRED"
          );
          if (!blocked.ok) {
            return { ok: false, error: `${actor} approved ${kind}` };
          }
        }
        const missing = expectReject(
          kernel.resolveGate({ id: `gate_${kind}`, decision: "approve" }),
          "HUMAN_REQUIRED"
        );
        if (!missing.ok) {
          return { ok: false, error: `${kind} approved without actor` };
        }
        const via = expectReject(
          kernel.resolveGate({
            id: `gate_${kind}`,
            decision: "approve",
            actor: HUMAN_ACTOR,
            via: "merge",
          }),
          "AUTO_APPROVE_FORBIDDEN"
        );
        if (!via.ok) {
          return { ok: false, error: `${kind} approved via merge` };
        }
        const still = expectOk(kernel.listNeedYou());
        if (!still.ok) {
          return still;
        }
        if (still.data.gates.length !== 1 || still.data.gates[0].status !== "open") {
          return { ok: false, error: `${kind} left open=${JSON.stringify(still.data.gates)}` };
        }
        const human = expectOk(
          kernel.resolveGate({ id: `gate_${kind}`, decision: "approve", actor: HUMAN_ACTOR })
        );
        if (!human.ok) {
          return human;
        }
        if (human.data.gate.status !== "approved") {
          return { ok: false, error: JSON.stringify(human.data.gate) };
        }
        return { ok: true };
      })
    );
  });

  rows.push(
    runCase("unknown kind rejects", () => {
      return expectReject(fresh().createGate({ kind: "reply", title: "comment" }), "UNKNOWN_KIND");
    })
  );

  rows.push(
    runCase("bind notes store chat thread id and board card id", () => {
      const kernel = fresh({ ids: { next: () => "gate_b" } });
      const created = expectOk(
        kernel.createGate({
          kind: "merge",
          title: "Merge with binds",
          chat_thread_id: "thread_9",
          board_card_id: "card_4",
        })
      );
      if (!created.ok) {
        return created;
      }
      const binds = created.data.gate.binds;
      if (binds.chat_thread_id !== "thread_9" || binds.board_card_id !== "card_4") {
        return { ok: false, error: JSON.stringify(binds) };
      }
      return { ok: true };
    })
  );

  rows.push(
    runCase("idempotent approve of already approved gate", () => {
      const kernel = fresh({ ids: { next: () => "gate_i" } });
      kernel.createGate({ kind: "db", title: "Migrate" });
      kernel.resolveGate({ id: "gate_i", decision: "approve", actor: HUMAN_ACTOR });
      const again = expectOk(
        kernel.resolveGate({ id: "gate_i", decision: "approve", actor: HUMAN_ACTOR })
      );
      if (!again.ok) {
        return again;
      }
      return expectReject(
        kernel.resolveGate({ id: "gate_i", decision: "reject", actor: HUMAN_ACTOR }),
        "ALREADY_RESOLVED"
      );
    })
  );

  return rows;
}

function main() {
  const started = Date.now();
  const rows = cases();
  const passed = rows.filter((row) => row.ok).length;
  const failed = rows.filter((row) => !row.ok);
  const wallMs = Date.now() - started;
  const packet = {
    ok: failed.length === 0,
    module: "studio/hitl",
    instrument: "hitl.gates",
    measured_exit: failed.length === 0 ? 0 : 1,
    expect_exit: 0,
    wall_ms: wallMs,
    cases: rows.length,
    passed,
    failed: failed.length,
    clock_started: false,
    verdict: null,
    failures: failed.map((row) => ({ name: row.name, detail: row.detail })),
  };

  process.stdout.write(`${JSON.stringify(packet)}\n`);
  if (!packet.ok) {
    for (const row of failed) {
      process.stderr.write(`FAIL ${row.name}: ${row.detail}\n`);
    }
    process.stderr.write(
      `FAIL studio/hitl gates (measured; cases=${packet.cases} passed=${passed} failed=${failed.length}; wall_ms=${wallMs})\n`
    );
    process.exit(1);
  }
  process.stdout.write(
    `PASS studio/hitl gates (measured; cases=${packet.cases} passed=${passed} failed=0; wall_ms=${wallMs})\n`
  );
}

main();
