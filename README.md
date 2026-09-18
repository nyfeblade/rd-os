# rd-os

Local-first R&D OS — portable MCP contract + Ink Desk (Waiting) + Proof Layer as first instrument.

CNP skill v2 FAIL Δ=+0.20 — skill theater is not proven. This tree is a **usable lab**, not a 14-day PASS.

| Path | What |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | MCP + human steer; `attention.dump` is SoT |
| [rd-os-design/steer-ui-v2.md](rd-os-design/steer-ui-v2.md) | Ink Desk product UI spec (supersedes v1) |
| [MCP_CONTRACT.md](MCP_CONTRACT.md) | Tool names, reject codes, stdio MCP server |
| [KILL_14D.md](KILL_14D.md) | 14-day kill vs markdown baseline — day 0 armable; clock not started |
| [INSTRUMENTS.md](INSTRUMENTS.md) | Proof Layer `npm run demo:reject` hook |
| [ui/](ui/) | Ink Desk — Waiting / Experiments / History / Settings over the dump |
| [bin/lab.js](bin/lab.js) | `npm start` — UI + JSON API |
| [bin/mcp.js](bin/mcp.js) | stdio MCP server agents attach |
| [bin/rdos.js](bin/rdos.js) | CLI: `rdos <tool> --in payload.json --out result.json` |

## One command (clone → lab)

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os
npm start
```

Waiting home: [http://127.0.0.1:7420](http://127.0.0.1:7420). MCP: `RDOS_HOME=./var node bin/mcp.js`. Human steer: UI Approve/Reject or `rdos steer.gate --actor human`.

Proof screenshot fixtures: `node bin/lab.js --no-seed --fixture needs-you` (also `proof-waiting`, `agent-waiting`, `history`).

## Eng Proof dual-gate

```bash
chmod +x scripts/*.sh
npm run dual-gate
```

`verdict` stays null. `clock_started` stays false. Harness executable ≠ day-14 PASS.
