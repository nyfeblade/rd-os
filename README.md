# rd-os

Local-first R&D OS — portable MCP contract + human steer cockpit + Proof Layer as first instrument.

CNP skill v2 FAIL Δ=+0.20 — skill theater is not proven. This tree is a **usable lab**, not a 14-day PASS.

| Path | What |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Two surfaces: MCP + human steer (UI renders `attention.dump`) |
| [MCP_CONTRACT.md](MCP_CONTRACT.md) | Tool names, reject codes, stdio MCP server |
| [KILL_14D.md](KILL_14D.md) | 14-day kill vs markdown baseline — day 0 armable; clock not started |
| [INSTRUMENTS.md](INSTRUMENTS.md) | Proof Layer `npm run demo:reject` hook |
| [ui/](ui/) | Human steer UI (thesis, attention, evidence, bottleneck, redirect) |
| [bin/lab.js](bin/lab.js) | `npm start` — UI + JSON API |
| [bin/mcp.js](bin/mcp.js) | stdio MCP server agents attach |
| [bin/rdos.js](bin/rdos.js) | CLI: `rdos <tool> --in payload.json --out result.json` |

First instrument (merged Exp-1): [agent-proof-layer](https://github.com/nyfeblade/agent-proof-layer).

## One command (clone → lab)

Cold clone, Node 18+, no npm install.

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os
npm start
```

Opens the steer UI at [http://127.0.0.1:7420](http://127.0.0.1:7420). MCP attach (stdio):

```bash
RDOS_HOME=./var node bin/mcp.js
```

Human steer is the UI / `rdos steer.gate --actor human`. Agents speaking MCP get `NOT_HUMAN` on `steer.gate`.

## Eng Proof dual-gate

```bash
chmod +x scripts/*.sh
npm run dual-gate
```

That runs stranger-check (board + MCP smoke + UI smoke + day-0 fields), wedge-measure, `proof-layer` (`npm run demo:reject` → `REJECTED` + `measured_exit`), and `kill14d` day 0 both arms.

`verdict` stays null. `clock_started` stays false. Harness executable ≠ day-14 PASS. Human merge only.
