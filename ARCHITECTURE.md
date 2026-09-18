# R&D OS wedge — architecture (stack research)

**Status:** usable local-first lab — board/packets + stdio MCP server + `attention.dump` SoT + Ink Desk v2 (dump view) + Proof Layer `demo:reject` hook + day-0 kill harness. No second CA. Harness ≠ 14-day PASS.  
**Board:** [Exp-2 R&D OS](https://app.notion.com/p/3dee07d17270817e9d01d8821b3ec2f5)  
**Vehicle:** this repo (`nyfeblade/rd-os`).  
**First instrument (merged Exp-1):** [`nyfeblade/agent-proof-layer`](https://github.com/nyfeblade/agent-proof-layer) ([PR #1](https://github.com/nyfeblade/agent-proof-layer/pull/1) merged `de40fcc`).  
**Playbook:** [Engineering Playbook](https://app.notion.com/p/3dee07d17270814c86ade37190fd7ac5) — dual-gate, no self-cert, ResourceExhausted ⇒ STOP.

This document is **not** a verdict that the wedge works. CNP skill harness v2 **FAILED** (OUT Δ=+0.20, required ≥+1.5 vs a strong same-tools baseline). Do not treat markdown/skill theater as proven power.

---

## HARD LAW (product requirements — not a side essay)

These five rules are the product. They sit **beside** the live attention pane (P0). Every interface below maps to one or more of them.

1. **Machine-time fields** on every experiment: `estimate_ca_hours`, `estimate_proof_min`, `human_gates[]`, `actuals`. Ban human-week units unless a human gate is listed.
2. **Multi-lane fan-out:** spawn N parallel cheap probes; each must fetch or run; recombine evidence-only; anti-single-lane check before ACCEPT plan.
3. **Research-before-claim + anti-shrink** in the agent MCP contract: reject weight-only verdicts; reject under-scope without a physics or human constraint.
4. **Envelope memory:** store finished CA-hour baselines for planning.
5. **Live attention pane is still the P0 wedge.** This law sits beside it — same dump, same desk, not a buried appendix.

---

## Problem

Coding agents (Cursor CloudAgents, Claude Code, Grok, others) ship prose: "tests passed", "two weeks", "LGTM". Humans and other agents cannot cheaply tell measured from narrated. Two measured facts already constrain the design:

| Fact | Source | Implication |
| --- | --- | --- |
| Proof Layer **REJECTED** a planted-false "tests passed" claim (`measured_exit` 1 vs expect 0, `wall_ms` 508 on `de40fcc`) | Eng Proof on Exp-1; stranger `npm run demo:reject` | Instruments that *run* claims beat self-cert. First instrument exists. |
| CNP skill v2 **FAIL** OUT Δ=+0.20 (need ≥+1.5 vs strong same-tools baseline) | Board Proof column; evidence `capability-ab-v2/` | Skill/markdown theater is **not** proven. Prefer instruments + contract rejects over more prose. |

The wedge is a **capability-native research lab OS**: portable contract any agent must speak, plus a human steer desk that keeps P0 and HARD LAW in one glance. It is not a chat app, visualizer, or second CloudAgent.

---

## Two surfaces (and only two)

```
 any agent ──stdio MCP (bin/mcp.js)──► R&D OS kernel
                                  │
                                  ├─ machine-time + envelope store
                                  ├─ multi-lane fan-out + evidence recombine
                                  ├─ Proof Layer (npm run demo:reject) as first instrument
                                  └─ attention.dump (P0 + HARD LAW adjacent)  ← data SoT
                                         │
 human ── Ink Desk / rdos steer.gate --actor human ─┘
         (UI is a view of attention.dump; never a second store)
```

### 1. Portable MCP (any agent)

A small tool contract, not a host that owns the agent's pipes. Agents remain Cursor / Claude / Grok / other. They **must** call R&D OS tools to ACCEPT a plan, submit a claim, or write a verdict. The server rejects illegal shapes (see `MCP_CONTRACT.md`). Portability rule: if an agent cannot speak MCP, a one-file CLI shim (`rdos <tool> <json>`) is enough. Do not wrap Claude the way Sightline does.

**Steal from Sightline, do not rebuild it.** [Sightline](https://github.com/nyfeblade/sightline) already hosts Claude Code, gates tool calls, and distinguishes Claimed / Checked / Verified (Verified requires a refutation that has *fired*). R&D OS steals the claim hygiene and the "waiting-on-you at the top" attention idea. It leaves behind: Claude-only hosting, desktop GUI, chief/worker fleet, in-process MCP that owns the binary. Exp-3 governor and parallel CAs are out of scope.

### 2. Human steer desk

Ink Desk is the human control surface. Source of truth is `attention.dump`. The Designer lock (`rd-os-design/steer-ui-v2.md`, mock `ink-desk-waiting.html`) is the product view: Waiting home, Experiments, History, Settings. Warm matte ink + copper only when a human must decide. HARD LAW is behavior + Settings rules, not a home chip strip. `steer-cockpit-v1` is superseded paper trail. Humans also steer with `rdos steer.gate --actor human`.

```json
{
  "p0": { "id": "…", "why": "…", "waiting_on": "human|agent|proof", "age_s": 0 },
  "hard_law": ["machine-time", "multi-lane", "research-before-claim", "envelope", "attention-beside-law"],
  "open_gates": [],
  "envelope_hint": { "nearest_experiment_id": null, "baseline_ca_hours": null }
}
```

If P0 and HARD LAW are not in the same dump, the desk is non-compliant. Ink Desk renders this dump; it may not invent a second source of truth.

---

## HARD LAW → interfaces

| Law | Kernel object | MCP tools | Cockpit |
| --- | --- | --- | --- |
| 1 Machine-time | `MachineTime` on every `Experiment` (`schema/machine-time.ts`) | `experiment.open`, `experiment.record_actuals` — reject missing fields or `human_week` without a gate | Show `estimate_ca_hours` / `estimate_proof_min` / open `human_gates[]`; never show "weeks" unless a gate exists |
| 2 Multi-lane | `FanOut` (`n≥2` unless constraint) | `plan.fanout`, `plan.accept` — anti-single-lane before ACCEPT | Show lane count + per-probe fetch/run evidence URIs |
| 3 Research-before-claim + anti-shrink | Claim + Plan validators | `claim.submit`, `plan.accept` — reject `WEIGHT_ONLY`, `UNDER_SCOPE`, `NO_RESEARCH` | Surface reject codes; human may add a physics/human constraint, not a vibe override |
| 4 Envelope memory | append-only `envelope/` baselines | `envelope.query`, `envelope.record` (only after `actuals` filled + experiment finished) | Next-plan hint: nearest finished CA-hour baseline or `NO_BASELINE` |
| 5 Attention P0 beside law | `attention.dump` | `attention.dump` | Waiting interrupt + Settings rules; no buried law |

### Law 1 — machine-time (detail)

Banned on the experiment record: `estimate_weeks`, `human_weeks`, `sprints`, calendar-week planning units. Allowed time units:

- **CA hours** (`estimate_ca_hours`, `actuals.ca_hours`) — CloudAgent / agent compute.
- **Proof minutes** (`estimate_proof_min`, `actuals.proof_min`) — Eng Proof wall time to falsify.
- **Human hours** — only inside a listed `human_gates[]` entry (`estimate_human_hours`).

A human gate is a named stop the machine cannot pass: `merge`, `proof_accept`, `quota_unfreeze`, `scope_change`, `physical_access`, `legal`, `other`. Playbook lock: human-owned merges; bots never merge. ResourceExhausted is a stop, not a retry — treat as `quota_unfreeze` gate, Notes=`quota-blocked`.

### Law 2 — multi-lane (detail)

Before `plan.accept`:

1. `n ≥ 2` cheap probes **or** a listed physics/human constraint that makes N=1 legal (example: single-file compile after envelope proves the path; or `human_gates` includes `physical_access`).
2. Each probe has `kind: fetch | run` and must actually fetch or run (Proof Layer `apl prove` is a legal `run`).
3. Recombine is **evidence-only**: packets, exit codes, URLs, logs. Prose summaries are not evidence. A lane that only returns a confidence number is discarded and counted as cost tax (playbook: useless probes count against the score).
4. Anti-single-lane check is a hard reject (`SINGLE_LANE`), not a warning.

Playbook capability bar still applies when someone later grades A vs B: strong same-tools baseline, blind grade, cost tax, held-out prompts. Δ alone is not physics. CNP v2's +0.20 is the cautionary measurement.

### Law 3 — research-before-claim + anti-shrink (detail)

See `MCP_CONTRACT.md`. Short form:

- A claim without a fetch/run instrument packet is `NO_RESEARCH`.
- A verdict that is only a weight/confidence/score is `WEIGHT_ONLY`.
- A plan that drops scope (fewer probes, weaker kill, missing instrument) without naming a physics limit or a human gate is `UNDER_SCOPE`.

### Law 4 — envelope memory (detail)

When an experiment reaches `finished` with `actuals.ca_hours` filled, append one baseline:

```
envelope/baselines/<experiment_id>.json
```

Planning **must** call `envelope.query` (or the CLI equivalent) and either cite the nearest baseline or emit `NO_BASELINE`. Planning from a blank "two weeks" is a Law 1 + Law 4 reject.

### Law 5 — attention pane (detail)

P0 is the only interrupt that may preempt the current experiment. The pane answers: what is waiting, on whom, for how long. HARD LAW is the adjacent field so a stranger opening the dump cannot miss the contract. M7 grades the dump, not chrome (see `KILL_14D.md`).

---

## Kernel objects (this PR: local file runtime)

| Object | File | Runtime in this PR |
| --- | --- | --- |
| `MachineTime`, `HumanGate`, `Actuals` | `schema/machine-time.ts` + `src/kernel.js` | `rdos experiment.open` writes `board/experiments/<id>.json` |
| `Experiment`, `FanOut`, `Probe` | `schema/experiment.ts` + `src/kernel.js` | local board packets; rejects `SINGLE_LANE` / `UNDER_SCOPE` |
| MCP tool names + reject codes | `schema/mcp.ts` + `bin/mcp.js` + `bin/rdos.js` | stdio MCP + CLI shim |
| Attention dump | `schema/attention.ts` + `src/attention.js` | `rdos attention.dump` → `board/attention.dump.json` |

No second CA. Do not claim 14d PASS because the harness exists.

---

## First instrument

Proof Layer (`apl prove`) is the only instrument this wedge may depend on on day 0. How it plugs into fan-out and envelope: `INSTRUMENTS.md`.

---

## Out of scope (park)

Parallel CloudAgents; CNP skill re-litigation without a new kill that beats a strong same-tools baseline; Exp-3 governor; group chat; Sightline rebuild; wrapping Claude/Cursor/Grok; starting the 14d clock as PASS.

---

## This wedge-build experiment (machine-time, not a week)

| Field | Value |
| --- | --- |
| `estimate_ca_hours` | 2 |
| `estimate_proof_min` | 25 |
| `human_gates[]` | `merge`, `proof_accept` |
| `actuals` | fill at finish; this CA does not self-cert |

---

## Sources

- Inbox brief + board Notes on [Exp-2](https://app.notion.com/p/3dee07d17270817e9d01d8821b3ec2f5).
- [Engineering Playbook](https://app.notion.com/p/3dee07d17270814c86ade37190fd7ac5): dual-gate, capability falsify, ResourceExhausted stop.
- [Agent Proof Layer brief](https://app.notion.com/p/3dee07d1727081499b03e8bc19d4e36e) + merged [PR #1](https://github.com/nyfeblade/agent-proof-layer/pull/1).
- Sightline README: Claimed/Checked/Verified; attention; ceilings. Not a dependency.
- CNP skill v2 FAIL Δ=+0.20 — capability-ab-v2 / board Proof. Skill theater not proven.
