# Instruments — Proof Layer first

**Instrument** = a program that fetches or runs and writes a packet a stranger can re-run. Prose, skills, and chat are not instruments.

CNP skill v2 FAIL Δ=+0.20: do not add a "skill instrument." Prefer runners.

---

## First instrument: Agent Proof Layer (merged Exp-1)

| | |
| --- | --- |
| Repo | https://github.com/nyfeblade/agent-proof-layer |
| Merge | [PR #1](https://github.com/nyfeblade/agent-proof-layer/pull/1) → `main` (`de40fcc`) |
| CLI | `apl prove <claim.json>` (`bin/apl.js`) |
| Results | `runner_result`: `VERIFIED` \| `REJECTED` \| `INCONCLUSIVE` |
| Verdict | **null** — Eng Proof only |
| Kill already hit | Planted-false expect_exit 0, fixture exit 1, `REJECTED`, `wall_ms` 508 (Eng Proof) |

Claim shape (from Exp-1):

```json
{
  "experiment_id": "exp-1-planted-false",
  "title": "Planted-false: tests passed",
  "hypothesis": "An agent claimed tests passed.",
  "commands": [
    { "run": "node fixtures/failing.js", "cwd": ".", "expect_exit": 0, "timeout_s": 30 }
  ]
}
```

Packet path: `evidence/runs/<experiment_id>/<timestamp>/packet.json` plus `cmd-N.log`.

R&D OS does **not** fork Proof Layer. It **calls** it as a `run` probe.

Hook in this wedge (script, not a glass UI):

```bash
./scripts/proof-layer.sh
```

That clones `nyfeblade/agent-proof-layer` (or uses `$APL_DIR`) and runs `npm run demo:reject`. On REJECTED it copies the packet into `evidence/proof-layer/` and may `claim.submit` into the local board. `verdict` stays null.

---

## Plug-in: multi-lane fan-out (Law 2)

Each lane is a probe. Proof Layer is the default `run` probe for ship claims.

```
plan.fanout
  probe p_run  kind=run   command_or_url="npx --yes github:nyfeblade/agent-proof-layer apl prove claims/<id>.json"
                 (or clone + npm run / node bin/apl.js — zero runtime deps)
  probe p_fetch kind=fetch command_or_url=<prior-art url or packet url>
  probe p_k     kind=run   command_or_url=<other cheap command>
         │
         ▼ each must fetch or run
  evidence_uri[]  (packets, logs, HTTP bodies)
         │
         ▼ recombine evidence-only
  plan.accept  ← anti-single-lane must pass
```

Rules:

1. A lane whose only output is a confidence number is dropped (`WEIGHT_ONLY` if it is the whole claim).
2. `apl prove` `INCONCLUSIVE` (timeout, spawn error) does **not** become ACCEPT. It is cost tax + missing evidence.
3. `REJECTED` is a successful measurement (planted-false happy path). Recombine keeps the packet.
4. N=1 whose only probe is `apl prove` is still `SINGLE_LANE` unless a physics/human constraint is listed. The instrument does not waive fan-out. Typical legal N=1: "re-run the same planted-false after envelope already stored this exact command" + named constraint.

Day-0 legal fan-out for "does the first instrument still work":

| Probe | Kind | Command |
| --- | --- | --- |
| p0 | run | `npm run demo:reject` in a Proof Layer checkout |
| p1 | fetch | `https://github.com/nyfeblade/agent-proof-layer/pull/1` |
| p2 | run | `./scripts/stranger-check.sh` in rd-os |

Recombine: three evidence URIs (demo stdout + PR HTML/API + stranger-check stdout). No prose summary required for ACCEPT.

---

## Plug-in: envelope memory (Law 4)

When an experiment that **used** Proof Layer finishes:

1. `experiment.record_actuals` writes `actuals.ca_hours` and `actuals.proof_min` (Proof wall time is often the `demo:reject` / `apl prove` `wall_ms`, in minutes).
2. Kernel `envelope.record` stores:

```json
{
  "experiment_id": "exp-1-planted-false",
  "instrument": "apl prove",
  "actuals_ca_hours": 0.2,
  "actuals_proof_min": 2,
  "runner_result": "REJECTED",
  "packet_uri": "evidence/runs/exp-1-planted-false/<ts>/packet.json",
  "finished_at": "2026-09-18T02:48:37Z"
}
```

3. Next plan that wants another claim-runner spike **must** `envelope.query`. If the nearest baseline is Exp-1 ~minutes, a new plan that estimates 40 CA hours for the same planted-false is `UNDER_SCOPE` inverted — it is **over**-scope without physics (quota, new language, new host). Envelope is a prior, not a vibe.

Seed (not a self-cert of Exp-2): after Luke's merge, Exp-1 is the first legal baseline to copy into `envelope/baselines/` when the store is implemented. This PR does not invent `actuals.ca_hours` for Exp-1; only Eng Proof / the finishing CA of Exp-1 may fill that number. Until then `envelope.query` returns `NO_BASELINE` for CA-hours and may still return the measured `wall_ms` 508 as **proof** minutes ≈ 1.

---

## Plug-in: research-before-claim (Law 3)

`claim.submit` is valid only with a Proof Layer packet (or a later instrument that meets the same bar: executed command, expected vs measured, stranger log).

Mapping:

| Proof Layer field | R&D OS field |
| --- | --- |
| `runner_result` | claim evidence; never `verdict` |
| `verdict: null` | stays null |
| `measured_exit` / logs | evidence recombine payload |
| `commit` | provenance |
| `wall_ms` | feeds `actuals.proof_min` when the experiment *is* the proof run |

Sightline's Claimed / Checked / Verified is compatible:

- Claimed = agent prose (untrusted).
- Checked = suite passed (`expect_exit` met) — necessary, not sufficient.
- Verified = a refutation that has **fired** at least once (Exp-1 planted-false is that refutation for the runner itself).

R&D OS `verdict` remains Eng Proof's word, even after `VERIFIED` runner_result.

---

## Next instruments (parked — do not build in Exp-2 research)

| Idea | Why parked |
| --- | --- |
| Fetch-only URL packer | Useful as a `fetch` probe; not needed until MCP server exists |
| Quota / ResourceExhausted probe | Playbook already: STOP. Exp-3 governor |
| Capability A/B harness | CNP v2 failed; new kill required before any CA |
| Sightline `refute` | Claude-host specific; steal the idea, do not vendor the GUI |

---

## Stranger check that the first instrument still exists

```bash
git clone https://github.com/nyfeblade/agent-proof-layer.git
cd agent-proof-layer
npm run demo:reject
```

Expect `REJECTED`. If this command cannot REJECT, the R&D OS wedge has no first instrument — stop, do not design more chrome.
