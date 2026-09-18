# CA4 — design clarifications (unprompted)

Use with TAURI-SHELL-SPEC + SCAFFOLD-PLAN + waiting-greyscale.html.  
If conflict: **greyscale HTML structure wins** for Waiting; this file wins for copy/mapping.

## Pick (no bikeshed)
- **Framework:** React + Vite + TS (default). Svelte OK if already spinning — don’t switch mid-PR.
- **Folder:** `desktop/` only (not both desktop/ and app/).

## App chrome
- Window title: `R&D OS`
- Product name in UI: `R&D OS` (not rd-os, not “steer cockpit”)
- Default route: Waiting
- Nav labels exact: `Waiting` · `Experiments` · `History` · `Settings`

## attention.dump → UI copy

| dump | UI |
| --- | --- |
| `waiting_on: human` | Waiting on column: `Human` |
| `waiting_on: proof` | `Proof` |
| `waiting_on: agent` | `Agent` |
| `p0.why` | “What” cell primary line (plain; don’t show raw ids as title if why exists) |
| `p0.age_s` | Age: `Xm` / `Xh Ym` / `Xd` (tabular-nums) |
| `p0.id` | Details only / footnote — not the headline |
| `open_gates[]` | Foot: `Open gates: …` humanized (`merge · Exp-2`), not raw `id:kind` only |
| `envelope_hint` nulls | `No similar run yet` |
| `envelope_hint.baseline_ca_hours` | `Last similar run: N CA hours` |

Human row only when `waiting_on === "human"`.  
Idle dump (`id: idle` / empty board): use **Empty** state from HTML — not a fake busy table.

## Settings → Rules (plain sentences)
1. Plan in CA hours and proof minutes — not weeks — unless a human gate is listed.
2. Run at least two cheap probes before accepting a plan, unless a real constraint says one is enough.
3. Don’t accept scores or vibes as proof — require fetch/run evidence.
4. Remember finished CA-hour baselines for the next plan.
5. Keep what’s waiting next to these rules — don’t bury them.

## Reject (minimal)
- Secondary button on human row opens a small sheet/dialog: reason list plain (`Score without evidence`, `Scope shrunk without a reason`, `Other`) + Cancel / Confirm reject.
- No toast across the window — confirm on the sheet; row updates on next dump read.

## Fixture (dev / stranger)
Ship `desktop/fixtures/attention.dump.json` with three variants or one file + comment:
- human-waiting (matches greyscale “Needs human”)
- in-flight only
Document in README: point `RDOS_HOME` or env override at fixtures for UI-only run.

## Still out
Touching `board/`, `src` kernel/db/lock, MCP server, accent color, glass.

## Questions parked
None blocking — if CA4 hits a fork, prefer greyscale HTML + this file over inventing chrome.
