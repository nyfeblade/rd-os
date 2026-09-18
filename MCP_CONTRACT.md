# MCP contract — portable, any agent

**Status:** contract + types only. No server in this PR.  
**Companion:** `ARCHITECTURE.md` (HARD LAW), `schema/mcp.ts`, `schema/machine-time.ts`.  
**Portability:** any agent that can call MCP tools or exec `rdos <tool> <json>` (shim, not built here). Do not require Cursor, Claude, or Grok specifically.

This contract is **enforcement**, not a skill file. CNP skill v2 FAILED (OUT Δ=+0.20 < +1.5 vs strong same-tools baseline). A markdown reminder to "do research" is not this contract.

---

## HARD LAW (must be enforced here, not documented elsewhere)

1. **Machine-time fields** on every experiment: `estimate_ca_hours`, `estimate_proof_min`, `human_gates[]`, `actuals`. Ban human-week units unless a human gate is listed.
2. **Multi-lane fan-out:** spawn N parallel cheap probes; each must fetch or run; recombine evidence-only; anti-single-lane check before ACCEPT plan.
3. **Research-before-claim + anti-shrink:** reject weight-only verdicts; reject under-scope without a physics or human constraint.
4. **Envelope memory:** store finished CA-hour baselines; planning must query them.
5. **Live attention pane is P0.** This law sits beside it in `attention.dump`.

If a tool implementation can ACCEPT a plan that violates any of 1–5, the implementation is non-compliant.

---

## Tool surface

Names are stable. Payloads are the types in `schema/`. Unknown tools → `UNKNOWN_TOOL`. Extra fields are ignored; missing required fields reject.

| Tool | Who calls | Accepts | Rejects |
| --- | --- | --- | --- |
| `experiment.open` | agent | `MachineTime` complete; no banned week units | `MISSING_MACHINE_TIME`, `HUMAN_WEEK_WITHOUT_GATE` |
| `experiment.record_actuals` | agent at finish | numeric `ca_hours` / `proof_min`; human hours only if gate listed | `MISSING_ACTUALS`, `HUMAN_WEEK_WITHOUT_GATE` |
| `envelope.query` | agent before plan | — | never reject; may return `NO_BASELINE` |
| `envelope.record` | kernel after finish | experiment `finished` + actuals filled | `NOT_FINISHED` |
| `plan.fanout` | agent | `n≥2` probes each `fetch\|run`, or named constraint | `SINGLE_LANE`, `PROBE_NOT_FETCH_OR_RUN` |
| `plan.accept` | agent (wants ACCEPT) | fan-out done; each probe fetched/ran; evidence-only recombine; anti-single-lane pass; envelope cited or `NO_BASELINE`; machine-time present | `SINGLE_LANE`, `NO_EVIDENCE_RECOMBINE`, `NO_ENVELOPE_QUERY`, `MISSING_MACHINE_TIME`, `UNDER_SCOPE`, `NO_RESEARCH` |
| `claim.submit` | agent | instrument packet (Proof Layer `runner_result` or equivalent fetch/run) | `NO_RESEARCH`, `WEIGHT_ONLY` |
| `claim.verdict_draft` | agent | not a final verdict; Eng Proof owns `verdict` | `SELF_CERT` if `verdict` is set by the authoring agent |
| `attention.dump` | agent or human | — | — (always returns P0 + HARD LAW siblings) |
| `steer.gate` | **human only** | add/resolve `human_gates[]` | `NOT_HUMAN` if agent calls it |

`rdos` CLI shim (future, not this PR): each tool is `rdos <tool> --in payload.json --out result.json`. Same reject codes.

---

## Reject codes (closed set)

Every reject is `{ ok: false, code, detail }`. Agents must not retry a reject by dropping fields.

```
MISSING_MACHINE_TIME
HUMAN_WEEK_WITHOUT_GATE
MISSING_ACTUALS
SINGLE_LANE
PROBE_NOT_FETCH_OR_RUN
NO_EVIDENCE_RECOMBINE
NO_ENVELOPE_QUERY
NOT_FINISHED
NO_RESEARCH
WEIGHT_ONLY
UNDER_SCOPE
SELF_CERT
NOT_HUMAN
UNKNOWN_TOOL
```

Exhaustive handling: `schema/mcp.ts` `assertNeverReject`.

---

## Research-before-claim

A **claim** is an assertion plus at least one instrument result the server executed or a stranger can re-run.

**Accept** when all are true:

1. `claim.commands[]` or `claim.evidence_uri` points at a packet from an instrument (first instrument: Proof Layer `apl prove` → `evidence/runs/<id>/<ts>/packet.json`).
2. Packet has `runner_result` ∈ {`VERIFIED`,`REJECTED`,`INCONCLUSIVE`} and measured exits — not a prose "tests passed".
3. `verdict` is `null`. Eng Proof (or independent verifier) sets `verdict`. Authoring agent sets `runner_result` only. Self-cert is `SELF_CERT`.
4. If the claim is a capability A-vs-B, the packet names the **strong same-tools baseline**, cost tax, and held-out set. Δ alone is `WEIGHT_ONLY`. CNP v2 Δ=+0.20 is **FAIL**, not a citation for power.

**Reject `NO_RESEARCH`** when:

- no packet, or packet is a markdown note / skill excerpt / chat screenshot;
- agent says "I looked it up" with no fetch/run URI;
- claim cites this contract or a SKILL.md as evidence.

**Reject `WEIGHT_ONLY`** when the verdict-or-claim body is only:

- a confidence / probability / stars / "high";
- a rubric score or Δ with no baseline strength, cost, or instrument;
- "LGTM", "looks good", "I am 90% sure".

Weight may appear **beside** evidence. Weight may not replace evidence.

Proof Layer prior: planted-false claim expected exit 0, fixture exited 1, runner printed `REJECTED` with measured log. That is research. "I ran the tests" is not.

---

## Anti-shrink

**Shrink** = a later plan that is weaker than the opened experiment's kill without a named constraint.

Examples that **must** reject `UNDER_SCOPE`:

| Opened | Later plan | Why reject |
| --- | --- | --- |
| N=3 probes, evidence recombine | N=1 "fast path" | single-lane + shrink |
| Kill: Δ≥+1.5 vs strong same-tools | Kill: "positive Δ" | soft baseline / soft Δ (playbook) |
| Instrument: `apl prove` packet | Instrument: "README says it works" | skill theater |
| `estimate_ca_hours: 4` | silent cut to 0.5 with same kill | missing physics/human constraint |
| Envelope baseline 3.0 CA-h | plan 0.2 CA-h, same scope, no `NO_BASELINE` explanation | envelope ignored |

**Legal shrink** (do not reject) only if the payload names one of:

- **Physics:** compile/test wall clock, quota (`ResourceExhausted`), missing tool, file-not-present, network deny.
- **Human gate:** an entry in `human_gates[]` (`scope_change`, `quota_unfreeze`, `merge`, …) with a reason string.

"We are out of time" is not physics unless `actuals` or quota evidence is attached. "Good enough" is not a human gate.

Anti-shrink runs on `plan.accept` and on any `experiment.open` that replaces an existing open experiment.

---

## Machine-time enforcement (Law 1)

`experiment.open` required body:

```json
{
  "experiment_id": "exp-2-rd-os-wedge",
  "estimate_ca_hours": 1.5,
  "estimate_proof_min": 20,
  "human_gates": [{ "kind": "merge", "reason": "playbook: human-owned merges" }],
  "actuals": { "ca_hours": null, "proof_min": null, "human_hours": null, "finished_at": null }
}
```

Reject if any required key is missing. Reject if any string/number field looks like week planning (`weeks`, `sprint`, `human_week`) unless `human_gates[]` is non-empty **and** the week-like unit appears only inside `human_gates[].estimate_human_hours` converted to hours (never stored as weeks).

---

## Multi-lane enforcement (Law 2)

`plan.fanout` body:

```json
{
  "n": 3,
  "probes": [
    { "id": "p0", "kind": "run", "command_or_url": "npx apl prove claims/planted-false.json" },
    { "id": "p1", "kind": "fetch", "command_or_url": "https://github.com/nyfeblade/agent-proof-layer" },
    { "id": "p2", "kind": "run", "command_or_url": "rg HARD LAW ARCHITECTURE.md MCP_CONTRACT.md" }
  ],
  "constraint": null
}
```

`plan.accept` walks probes: each must have `status: fetched | ran` and an `evidence_uri`. Then `anti_single_lane` must be `pass`. Recombine input is the list of evidence URIs only.

---

## Envelope (Law 4)

- `envelope.query({ similar: experiment_id | title })` → `{ baselines: [...], nearest, code?: "NO_BASELINE" }`.
- `plan.accept` requires a query id from this session or an explicit `NO_BASELINE` ack.
- `envelope.record` is kernel-side after `actuals.ca_hours` is a number and stage is finished.

---

## Attention (Law 5)

`attention.dump` returns P0 and HARD LAW in one object (see `ARCHITECTURE.md`). Agents may not strip `hard_law`. Humans use the dump as the steer cockpit until a UI exists.

---

## Human steer

| Action | Tool | Agent allowed? |
| --- | --- | --- |
| Dump P0 + law | `attention.dump` | yes |
| Add/resolve gate | `steer.gate` | no (`NOT_HUMAN`) |
| Set `verdict` | (Eng Proof process, not a tool in v0) | no (`SELF_CERT`) |
| Merge | git / GitHub — playbook human only | no |

Cockpit v0 = `attention.dump` + reading reject codes. No product UI.

---

## What this contract is not

- Not a SKILL.md. Skills failed the capability bar once already.
- Not Sightline's in-process Claude MCP. Portable beside hosts, not inside one host.
- Not Exp-3 governor. Quota freeze remains playbook: ResourceExhausted ⇒ STOP, no second CA.
- Not a self-cert path. `runner_result` ≠ `verdict`.
