# 14-day kill vs markdown baseline

**Hypothesis (not proven):** an instrumented R&D OS (MCP rejects + Proof Layer + envelope + attention dump) beats a **markdown baseline** (playbook + SKILL.md reminders, no contract enforcement) on the hygiene metrics below.

**This PR does not start the 14-day clock.** Day 0 is armable (`kill14d.sh --day 0`). An executable harness is not a day-14 PASS. Eng Proof dual-gates; this file is not a PASS on the wedge.

**Prior measured fact — do not launder:** CNP skill harness v2 **FAILED** (OUT Δ=+0.20, need ≥+1.5 vs strong same-tools baseline; evidence `capability-ab-v2/`). Markdown/skill theater is **not** a proven treatment. If anyone runs a capability A/B during the 14 days, the playbook bar applies: strong same-tools baseline, blind grade, cost tax, held-out prompts. Soft Δ is not physics. A +0.20-class result is FAIL, not "directional."

---

## Arms

| Arm | What the agent has | What it must not have |
| --- | --- | --- |
| **Markdown baseline (A)** | This repo's docs as prose + Engineering Playbook + optional SKILL.md that restates HARD LAW | No MCP reject server, no required `apl prove`, no envelope query gate, no `attention.dump` contract |
| **R&D OS treatment (B)** | Same docs **plus** MCP contract enforcement (or `rdos` CLI shim) + Proof Layer as required claim instrument + envelope store + `attention.dump` | No extra model, no extra tools the baseline lacks except the contract/instruments under test |

Same model family, same repo access, same proof-layer **availability**. The difference is **must-call / must-reject**, not "B was told to be excellent and A was not." Playbook: do not grade against a weak single-lane strawman.

N for planted sets is fixed below. Do not tune on the graded plants after day 0.

---

## Clock

| Day | What happens | Who |
| --- | --- | --- |
| **0** | Freeze this file + plant sets (`fixtures/kill-14d/` when implementation lands). Run **baseline A** on M1–M7. Record raw counts. No "we will do better." | Implementing CA + stranger can re-run plants |
| **7** | Treatment B wired enough to reject. Mid-check: M1 still green; M3+M4 ≥4/5; M5 ≥50% of new experiments. If M1 regresses, stop and report INCONCLUSIVE. | Same |
| **14** | Grade M1–M7 on held-out plants (same as day 0 set — do not add easy plants). **PASS** only if every metric PASSes. Any FAIL → **KILL** the wedge (do not add UI). | Eng Proof dual-gate |

ResourceExhausted ⇒ STOP the clock, Notes=`quota-blocked`, no burn-retry. Clock resumes only after human `quota_unfreeze`.

---

## Metrics — PASS/FAIL numbers

### M1 — planted-false reject (instrument)

| | |
| --- | --- |
| **What** | Proof Layer (or successor) REJECTS planted-false "tests passed" with measured exit ≠ expect |
| **Day 0** | Already measured on merged Exp-1: Eng Proof `npm run demo:reject` on `de40fcc` → first line `REJECTED`, `measured_exit` 1 vs 0, `wall_ms` 508 |
| **Day 7 / 14 PASS** | **3/3** planted-false claims `REJECTED`, each **wall_ms < 120000**, stranger log path + commit SHA printed |
| **FAIL** | <3/3, or any run >2 min, or `VERIFIED`/`INCONCLUSIVE` on a planted-false that executed |

Markdown arm is expected to **self-cert** at least once (prose "tests passed" without packet). That is the contrast, not a capability Δ.

### M2 — anti-single-lane before ACCEPT

| | |
| --- | --- |
| **What** | Plans that ACCEPT with `n<2` and no physics/human constraint |
| **Day 0 (A)** | Count ACCEPTs (or equivalent "ship it" prose) with a single lane on the planted multi-lane set (N=5 plants) |
| **Day 14 PASS (B)** | **0 / 5** unconstrained single-lane ACCEPTs. Constraint must be a named physics limit or `human_gates[]` entry |
| **FAIL** | ≥1 unconstrained N=1 ACCEPT |

### M3 — weight-only reject

| | |
| --- | --- |
| **Plant set** | 5 verdicts that are only confidence/Δ/LGTM (no fetch/run packet) |
| **Day 7** | B rejects ≥ **4/5** with code `WEIGHT_ONLY` |
| **Day 14 PASS** | **5/5** `WEIGHT_ONLY` |
| **FAIL** | any plant accepted or rejected under a different code that lets the weight stand as the claim |

### M4 — under-scope reject

| | |
| --- | --- |
| **Plant set** | 5 shrinks (drop probes, soften kill, swap instrument for README) with no physics/human constraint |
| **Day 7** | B rejects ≥ **4/5** with `UNDER_SCOPE` |
| **Day 14 PASS** | **5/5** `UNDER_SCOPE` |
| **FAIL** | any plant accepted |

### M5 — machine-time hygiene

| | |
| --- | --- |
| **What** | Every experiment record has `estimate_ca_hours`, `estimate_proof_min`, `human_gates[]`, `actuals`. Zero human-week units unless a gate is listed |
| **Day 7** | ≥ **50%** of experiments opened in days 1–7 compliant |
| **Day 14 PASS** | **100%** of experiments in the window compliant; **0** banned week units without a gate |
| **FAIL** | any missing field or banned unit on day 14 set |

### M6 — envelope memory

| | |
| --- | --- |
| **Day 7** | ≥ **1** finished baseline stored with `actuals.ca_hours` |
| **Day 14 PASS** | ≥ **3** finished CA-hour baselines; **100%** of new `plan.accept` calls cite `envelope.query` or `NO_BASELINE` |
| **FAIL** | <3 baselines, or any ACCEPT without query/ack |

### M7 — attention pane beside HARD LAW

| | |
| --- | --- |
| **What** | `attention.dump` (JSON) contains `p0` and `hard_law` as siblings |
| **Day 7** | dump exists; both keys present |
| **Day 14 PASS** | Stranger identifies P0 from dump in **≤30s**; `hard_law` length ≥5 (the five laws); no extra UI required |
| **FAIL** | missing P0, missing law, or law only in a wiki link |

### Overall

```
PASS  = M1 ∧ M2 ∧ M3 ∧ M4 ∧ M5 ∧ M6 ∧ M7
FAIL  = ¬PASS  →  KILL wedge (no product UI, no Exp-3)
```

Capability A/B Δ is **not** M8. Do not add it. If a later experiment wants Δ, new kill, new plants, strong baseline.

---

## Stranger re-run commands

### Now (usable lab — MCP + UI + day 0, not 14d PASS)

Cold checkout, Node 18+, no npm install. Expect exit 0.

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os
npm start                          # steer UI http://127.0.0.1:7420
# other terminal / Eng Proof:
chmod +x scripts/*.sh
./scripts/stranger-check.sh        # board + MCP + UI smoke + day0 fields
./scripts/proof-layer.sh           # npm run demo:reject → REJECTED + measured_exit
./scripts/kill14d.sh --arm markdown --day 0
./scripts/kill14d.sh --arm rdos --day 0 --skip-m1
# or one command:
npm run dual-gate
```

`stranger-check.sh` asserts HARD LAW strings, opens a local board packet, dumps attention, rejects weight-only, smokes stdio MCP + steer UI, and runs day-0 kill fields (`--skip-m1` so a cold rd-os clone does not require cloning Proof Layer). It does **not** certify the 14-day experiment and does **not** start the clock (`clock_started: false`, `verdict: null`).

### First instrument (already merged — M1 day-0 evidence)

```bash
git clone https://github.com/nyfeblade/agent-proof-layer.git
cd agent-proof-layer
# main after merge; pin if needed: git checkout de40fcc
npm run demo:reject
```

Expect first line `REJECTED`, `measured_exit: 1`, log path, commit SHA, wall time < 2 minutes.

### Day 0 / 7 / 14 (clock not started by this PR)

Commands are frozen here so they cannot be invented at grade time. Day 0 is armable now:

```bash
# from rd-os; required keys filled; verdict stays null; clock_started false
./scripts/kill14d.sh --arm markdown --day 0 | tee evidence/kill-14d/day0-markdown.json
./scripts/kill14d.sh --arm rdos     --day 0 --skip-m1 | tee evidence/kill-14d/day0-rdos.json
./scripts/kill14d.sh --arm rdos     --day 7 | tee evidence/kill-14d/day7-rdos.json
./scripts/kill14d.sh --arm rdos     --day 14 | tee evidence/kill-14d/day14-rdos.json
```

M1 (live `demo:reject`) needs a Proof Layer checkout; omit `--skip-m1` when Eng Proof grades M1. `--skip-m1` is for the rd-os-only stranger path. A stranger on day 14 must be able to re-run the three tees and get the same integer counts. This PR does **not** start the 14-day clock.

Required keys in each JSON:

```
m1_rejected m1_n m2_illegal_accepts m3_weight_only_rejected m3_n
m4_underscope_rejected m4_n m5_compliant m5_n m6_baselines m6_accepts_without_query
m7_p0_present m7_hard_law_n
```

PASS/FAIL is computed from the numbers in this file, not from a narrative.

---

## Dual-gate (Eng Proof)

Accept as **kill-clarity** only if:

1. A stranger can run `./scripts/stranger-check.sh` on this PR head and get exit 0 (board + MCP + UI smoke + day0 fields).
2. Every metric above has an integer threshold (no "better", no "faster feel").
3. CNP v2 FAIL is cited; this file does not claim skill theater works.
4. `verdict` on the 14-day run stays null until Eng Proof fills it.

Reject self-cert, chat screenshots, or "docs look complete."
