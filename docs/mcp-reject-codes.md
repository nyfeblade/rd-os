# MCP reject codes (CA2 control plane)

Every reject is `{ ok: false, code, detail }`. Closed set in `src/mcp/reject.js` and `contracts/reject-codes.json`. Exhaustive handling: `assertNeverReject`.

Agents must not retry a reject by dropping fields. **RESOURCE_EXHAUSTED ⇒ STOP** (playbook: no second CA).

| Code | When | Retry? |
| --- | --- | --- |
| `MISSING_MACHINE_TIME` | thesis / budget missing required machine-time fields | fix payload, new key |
| `HUMAN_WEEK_WITHOUT_GATE` | week/sprint unit with empty `human_gates[]` | add a listed gate |
| `MISSING_ACTUALS` | reserved (v0 actuals); not emitted by CA2 writes today | — |
| `SINGLE_LANE` | reserved (v0 plan.accept) | — |
| `PROBE_NOT_FETCH_OR_RUN` | reserved (v0 fan-out) | — |
| `NO_EVIDENCE_RECOMBINE` | reserved (v0 plan.accept) | — |
| `NO_ENVELOPE_QUERY` | reserved (v0 plan.accept) | — |
| `NOT_FINISHED` | reserved (v0 envelope.record) | — |
| `NO_RESEARCH` | no instrument packet, markdown/skill, missing packet_id | attach a real packet |
| `WEIGHT_ONLY` | confidence / Δ / LGTM with no runner_result | attach evidence |
| `UNDER_SCOPE` | reserved (v0 anti-shrink) | — |
| `SELF_CERT` | agent-set packet verdict, or 14d verdict on `proof.verdict` | leave verdict to proof seat |
| `NOT_HUMAN` | agent called `gate.add` / `gate.resolve` | human actor only |
| `UNKNOWN_TOOL` | name not in the six families | do not invent tools |
| `MISSING_FIELD` | required field absent (non-machine-time) | fix payload |
| `MISSING_IDEMPOTENCY_KEY` | mutator omitted `idempotency_key` | send a key |
| `IDEMPOTENCY_CONFLICT` | same key, different payload | new key for a new op |
| `LOCK_HELD` | second writer, or release with wrong holder/token | wait or use the holder token |
| `LOCK_REQUIRED` | write / release without a matching lock | `lock.acquire` first |
| `SEAT_FORBIDDEN` | author/human `proof.verdict`, or illegal seat role | assign proof seat |
| `GATE_UNKNOWN_KIND` | kind not in the legal human-gate set | use a listed kind |
| `RESOURCE_EXHAUSTED` | spend would exceed CA-hour or proof-min budget | **STOP. No retry.** |
| `CLOCK_STARTED_FORBIDDEN` | payload sets `clock_started: true` | leave the clock unarmed |
| `NOT_FOUND` | budget/gate row missing | set / add first |

v0 codes that CA2 does not emit yet stay in the closed set so a later merge with `bin/mcp.js` does not fork the enum.
