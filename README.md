# rd-os

R&D OS wedge — capability-native research lab OS.

**This tree is the smallest runnable wedge:** local board/packets, `attention.dump` file, Proof Layer hook, 14d harness stubs. No product UI. No MCP server process. No second CA.

| Path | What |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Two surfaces (portable MCP + human steer cockpit) and HARD LAW → interfaces |
| [MCP_CONTRACT.md](MCP_CONTRACT.md) | Tool names, reject codes, research-before-claim, anti-shrink |
| [KILL_14D.md](KILL_14D.md) | 14-day kill vs markdown baseline — PASS/FAIL numbers + stranger cmds |
| [INSTRUMENTS.md](INSTRUMENTS.md) | Proof Layer as first instrument |
| [schema/](schema/) | Machine-time / experiment / MCP / attention types |
| [bin/rdos.js](bin/rdos.js) | CLI shim: `rdos <tool> --in payload.json --out result.json` |
| [board/](board/) | Local board (runtime packets under `$RDOS_HOME/board`) |

First instrument (merged Exp-1): [agent-proof-layer](https://github.com/nyfeblade/agent-proof-layer).

CNP skill v2 FAIL Δ=+0.20 — skill theater is not proven.

## Stranger check (this PR)

Cold clone, Node 18+, no npm install. Expect exit 0.

```bash
chmod +x scripts/stranger-check.sh scripts/kill14d.sh scripts/proof-layer.sh scripts/wedge-measure.sh
./scripts/stranger-check.sh
```

Expect `PASS stranger-check (board + attention + packet + 14d stubs; not a 14d verdict)`.

```bash
./scripts/kill14d.sh --arm markdown --day 0
./scripts/kill14d.sh --arm rdos --day 7 --skip-m1
./scripts/proof-layer.sh   # clones agent-proof-layer; expect REJECTED
./scripts/wedge-measure.sh # packet completeness / time-to-falsify vs markdown path
```

That is not a 14-day PASS. `verdict` stays null. Human merge only.
