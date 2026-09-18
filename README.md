# rd-os

R&D OS wedge — capability-native research lab OS.

**This tree is stack research + types.** No product UI. No MCP server process.

| Doc | What |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Two surfaces (portable MCP + human steer cockpit) and HARD LAW → interfaces |
| [MCP_CONTRACT.md](MCP_CONTRACT.md) | Tool names, reject codes, research-before-claim, anti-shrink |
| [KILL_14D.md](KILL_14D.md) | 14-day kill vs markdown baseline — PASS/FAIL numbers + stranger cmds |
| [INSTRUMENTS.md](INSTRUMENTS.md) | Proof Layer as first instrument |
| [schema/](schema/) | Machine-time / experiment / MCP / attention types only |

First instrument (merged Exp-1): [agent-proof-layer](https://github.com/nyfeblade/agent-proof-layer).

CNP skill v2 FAIL Δ=+0.20 — skill theater is not proven.

## Stranger check (this PR)

```bash
chmod +x scripts/stranger-check.sh
./scripts/stranger-check.sh
```

Expect `PASS stranger-check`. That is not a wedge verdict.
