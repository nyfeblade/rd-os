# MCP control-plane contract (CA2)

**Status:** contract + in-process dispatcher (`src/mcp/`). Not swapped into `bin/mcp.js` on this PR (fence).  
**Companion:** `MCP_CONTRACT.md` (v0 experiment/plan/claim tools — unchanged), `docs/mcp-reject-codes.md`, `contracts/`.  
**CA1 API (not on main yet):** `createControlPlane` from `src/board` — stubbed in `src/mcp/adapters/stub-plane.js` with `TODO(CA1)`.  
**Clock:** tools reject `clock_started=true`. This PR does not arm kill14d.

Portable: `const { createMcpContract } = require("./src/mcp")`. Same reject envelope as v0: `{ ok: false, code, detail }`. Extra fields ignored. Agents must not retry a reject by dropping fields. **ResourceExhausted ⇒ STOP, no retry, no second CA.**

---

## Families

| Family | Tools | Writes? | Idempotent mutators |
| --- | --- | --- | --- |
| board | `board.dump` `board.get` `board.set` `board.list_seats` `board.assign_seat` | set / assign_seat | yes |
| packet | `packet.index` `packet.upsert` | upsert | yes |
| lock | `lock.acquire` `lock.release` | both | yes |
| proof | `proof.verdict` | verdict | yes |
| gate | `gate.list` `gate.add` `gate.resolve` | add / resolve | yes |
| budget | `budget.list` `budget.set` `budget.spend` | set / spend | yes |

Read tools never require `idempotency_key`. Every mutator **requires** `idempotency_key`.

---

## Idempotency

Mutator without `idempotency_key` → `MISSING_IDEMPOTENCY_KEY`.

Same `(tool, idempotency_key)` + same payload (key itself excluded from the hash) → **replay** the stored result. No second write.

Same key + different payload → `IDEMPOTENCY_CONFLICT`. Do not reuse a key after changing lock_token, amounts, or ids.

A replay of `RESOURCE_EXHAUSTED` stays `RESOURCE_EXHAUSTED`. A new key on an already-exhausted spend still rejects `RESOURCE_EXHAUSTED` because the budget state did not grow.

---

## Tool rules

### board

`board.dump` → thesis, packets, locks (no token), seats, budgets.  
`board.get` → the single ACTIVE thesis slot (or null).  
`board.set` → `thesis.set`. Requires `experiment_id`, `title`, `lock_token`. Week units without `human_gates[]` → `HUMAN_WEEK_WITHOUT_GATE`. Write without lock → `LOCK_REQUIRED`.  
`board.assign_seat` → role `author|proof|human`. Missing / illegal role → `SEAT_FORBIDDEN`.  
`board.list_seats` → optional `experiment_id`.

### packet

`packet.upsert` is research-before-claim (HARD LAW 3):

- instrument packet or `runner_result` ∈ {`VERIFIED`,`REJECTED`,`INCONCLUSIVE`} plus uri / packet_id
- `verdict` on the payload → `SELF_CERT` (only `proof.verdict` may set it)
- weight-only body / confidence / Δ / LGTM with no packet → `WEIGHT_ONLY`
- markdown / `skill.md` / `kind: markdown` → `NO_RESEARCH`
- missing `packet_id` → `NO_RESEARCH`
- write without lock → `LOCK_REQUIRED`

`packet.index` lists indexed packets.

### lock

One writer. Resource defaults to `board`.

- `lock.acquire` same holder → ok, `refreshed: true`, same token
- second holder → `LOCK_HELD`
- `lock.release` needs holder + `lock_token`; mismatch → `LOCK_HELD`; no lock → `LOCK_REQUIRED`

Writes on board / packet / seat / budget / proof require `lock_token`.

### proof

`proof.verdict` sets **packet** verdict only. Author (default if no seat) → `SEAT_FORBIDDEN`. Proof seat + lock → ok.  
`clock_started: true` → `CLOCK_STARTED_FORBIDDEN`. A 14-day verdict field → `SELF_CERT`. `verdict` on kill14d stays null.

### gate

Human gates (`merge`, `proof_accept`, `quota_unfreeze`, `scope_change`, `physical_access`, `legal`, `other`).

- `gate.add` / `gate.resolve` from an agent → `NOT_HUMAN`
- unknown kind → `GATE_UNKNOWN_KIND`
- resolve of a missing open gate → `NOT_FOUND`

Store is MCP-owned until CA1 adds a gates table (`TODO(CA1)` in `src/mcp/gates.js`).

### budget

`budget.set` requires numeric `ca_hours_budget` and `proof_min_budget`.  
`budget.spend` adds `ca_hours` and/or `proof_min`. If spent would exceed either cap → `RESOURCE_EXHAUSTED` and **STOP**. Do not retry, do not spawn another CA, do not drop fields to sneak a spend. Human `quota_unfreeze` is the only resume.

---

## Wire to CA1

```
src/mcp/adapters/plane.js
  try require("../../board").createControlPlane(home)   // CA1, when on main
  else createStubPlane()                                // this PR
```

Stub reject codes and return shapes match CA1 commit `b5b3264` (`LOCK_REQUIRED`, `LOCK_HELD`, `SEAT_FORBIDDEN`, author cannot `proof.verdict`).

---

## Stranger re-run

Cold checkout, Node 18+, no npm install. Expect exit 0.

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os
node contracts/run.js
echo "exit=$?"
```

Does **not** start the 14-day clock. Does **not** call `bin/mcp.js`. `clock_started` stays false.
