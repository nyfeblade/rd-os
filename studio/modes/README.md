# studio/modes — mode rails

Three rails an AI coding lane has to stay inside, as an importable library plus fixtures plus a prove script. Node 18+, no npm install, no UI.

```bash
node studio/modes/prove.js                                     # exit 0
node studio/modes/prove.js --gate studio/modes/fixtures/good   # exit 0
node studio/modes/prove.js --gate studio/modes/fixtures/planted # exit 2
```

The library grades rails, not work. Every report comes back with `verdict: null` and `clock_started: false`, whatever the record under test says. A rail can tell you a lane cut a corner; it cannot tell you the lane was right.

## The three rails

| Rail | Forces | Codes |
| --- | --- | --- |
| `research-before-claim` | No claim without named evidence and a kill line. In `eng` mode at least one piece of evidence must be a command with a recorded exit code. | `NO_CLAIMS` `NO_EVIDENCE` `UNNAMED_EVIDENCE` `UNKNOWN_EVIDENCE_KIND` `UNMEASURED_EVIDENCE` `NO_KILL_LINE` |
| `multi-lane-awareness` | Fences are read from `lanes.json`, never from the lane's own run record. A lane may narrow its fence, never widen it, and never reach into another lane's paths. | `NO_FENCE` `FENCE_OVERLAP` `FENCE_ESCAPE` `LANE_COLLISION` |
| `no-self-cert` | The verdict belongs to a proof seat and the clock to the kill harness. Claims report measurements; words like `verified` or `passes` are reserved vocabulary. | `SELF_CERT_VERDICT` `SELF_CERT_CLAIM` `CLOCK_STARTED_FORBIDDEN` |

`VIOLATION_CODES` is a closed set — `rails.js` throws if code outside it is ever constructed.

## Lane run record

The thing under test. Written by whatever drives the lane; the rails only read it.

```json
{
  "mode": "eng",
  "lane": "studio-d-modes",
  "fence": { "allow": ["studio/modes/"] },
  "touched_paths": ["studio/modes/index.js"],
  "commands": [{ "cmd": "node studio/modes/prove.js", "exit_code": 0 }],
  "claims": [
    {
      "id": "c1",
      "text": "node studio/modes/prove.js exits 0 over the fixtures.",
      "evidence": [{ "kind": "command", "ref": "node studio/modes/prove.js" }],
      "kill": "Break a rail and the exit code changes."
    }
  ],
  "verdict": null,
  "clock_started": false
}
```

`kind` is `command`, `file`, or `url`. A `command` evidence is only evidence if the same string appears in `commands` with an integer `exit_code` — citing a command you never ran trips `UNMEASURED_EVIDENCE`.

## Library

```js
const modes = require("./studio/modes");

modes.evaluateRun(record);            // -> { ok, violations[], counts, verdict: null, clock_started: false }
modes.evaluateFile("run.json");       // same, plus file
modes.loadMode("eng");                // mode profile (data)
modes.loadLanes();                    // lane registry
modes.listModes();                    // ["design", "eng"]
modes.RAILS;                          // the three rail names
modes.VIOLATION_CODES;                // the closed code set
```

Each violation is `{ rail, code, where, detail }` — `where` is a JSON path into the record, `detail` is the sentence a human needs.

## Files

| Path | What |
| --- | --- |
| `index.js` | Public API; composes the rails a mode enables |
| `rails.js` | The three rails as pure functions; the closed code set |
| `lanes.json` | Lane → owned path prefixes. Rail 2's source of truth |
| `modes/eng.mode.json` | Eng profile: measured command required per claim |
| `modes/design.mode.json` | Design profile: a spec or artifact may stand in for a command |
| `fixtures/good/` | Records that clear every rail |
| `fixtures/planted/` | One record per violation, each declaring the codes it should trip |
| `prove.js` | Expectation suite (default) and gate (`--gate`) |

Modes and lanes are data. Adding a lane is an edit to `lanes.json`; adding a mode is a new `modes/<name>.mode.json`. Neither needs a code change.

## Adding a fixture

Drop a run record in `fixtures/good/` or `fixtures/planted/` with an `expect` block:

```json
{ "expect": { "ok": false, "violations": ["FENCE_ESCAPE"], "why": "lane edits a path outside its own fence" } }
```

`prove.js` compares the exact set of codes the rails produce against `expect.violations`. Missing codes and surprise codes both fail. It also refuses to exit 0 if there are no good fixtures (rails rejecting everything) or no planted ones (rails accepting everything), and re-checks that no planted record clears the gate.

## Re-run from cold

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os
node studio/modes/prove.js
```

Expect `mode rails 18 passed, 0 failed` and exit 0. No `npm install`, no server, no database, nothing written to disk. It does not touch `src/`, `consumers/`, `ui/`, or another studio lane, and it does not arm `KILL_14D.md`.

To see the rails bite:

```bash
node studio/modes/prove.js --gate studio/modes/fixtures/planted/self-cert-verdict.json  # exit 2
node studio/modes/prove.js --gate studio/modes/fixtures/planted/skip-research.json      # exit 2
```

Harness executable ≠ day-14 PASS.
