# R&D OS desktop shell

Tauri 2 window that opens on the greyscale **Waiting** table. This tree is a view of `attention.dump`. It does not store experiments, arm the 14-day clock, or speak MCP.

Design source of truth (copied here, do not restyle from memory):

- [design/TAURI-SHELL-SPEC.md](design/TAURI-SHELL-SPEC.md)
- [design/SCAFFOLD-PLAN.md](design/SCAFFOLD-PLAN.md)
- [design/CA4-CLARIFICATIONS.md](design/CA4-CLARIFICATIONS.md) — copy map, Rules, Reject
- [design/tokens.css](design/tokens.css) — paper `#f4f4f2`, ink greys only
- [design/waiting-greyscale.html](design/waiting-greyscale.html) — cockpit graphic

## Stranger path (clone → window)

Needs Node 18+ and a current Rust (`rustup default stable`, 1.88+). The native window also needs a WebView (macOS/Windows ship one; Linux needs `libwebkit2gtk-4.1-dev`).

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os/desktop
npm install
```

Point the shell at a live board (lab default is `var/` at the repo root):

```bash
export RDOS_HOME=/absolute/path/to/rd-os/var
# UI-only: point at the designer human fixture
# export RDOS_DUMP="$PWD/fixtures/attention.dump.json"
npm run tauri dev
```

Cold open is **Waiting**. Approve / Reject sit on the human-waiting row only.

If `$RDOS_HOME/board/attention.dump.json` is missing, the panel is **Can’t reach the board** plus the path it looked for and **Retry**. Nothing is invented.

Release binary:

```bash
cd rd-os/desktop
npm install
npm run tauri build
```

`cargo tauri build` from `desktop/src-tauri` is the same path once `@tauri-apps/cli` is on `PATH` (`npx tauri build`).

## Frontend-only (no WebView)

Use this when GTK/WebKit is not installed. Same UI, Hash router, fixture dumps.

```bash
cd rd-os/desktop
npm install
npm run dev
```

Then open:

| State | URL |
| --- | --- |
| Needs human (default SoT table) | http://127.0.0.1:1420/?fixture=human#/waiting |
| Empty | http://127.0.0.1:1420/?fixture=empty#/waiting |
| In flight only | http://127.0.0.1:1420/?fixture=flight#/waiting |
| Dump missing | http://127.0.0.1:1420/?fixture=missing#/waiting |

Without `?fixture=` or `$RDOS_HOME`, the browser shell shows the missing-dump panel. That is intentional.

```bash
npm test
npm run build
```

## Dump contract

The window reads JSON from, in order:

1. `RDOS_DUMP` (absolute file)
2. `$RDOS_HOME/board/attention.dump.json`
3. `$RDOS_HOME/attention.dump.json`

A dump needs `p0` and `hard_law` as siblings. `p0.why` is the What line. `p0.id` is Details / footnote only. `p0.id === "idle"` is the Empty state. Optional `items[]` is the same row shape as `p0` — the shell will not invent rows when they are absent.

Shipped fixtures (see [fixtures/README.md](fixtures/README.md)):

- `fixtures/attention.dump.json` — human-waiting
- `fixtures/attention.dump.flight.json` — in-flight only
- `fixtures/attention.dump.empty.json` — idle

Reject opens a sheet (`Score without evidence` / `Scope shrunk without a reason` / `Other`) then Confirm reject / Cancel. The row updates on the next dump read. This shell does not write `board/`.

## Routes

| Route | Label | Status |
| --- | --- | --- |
| `#/waiting` | Waiting | implemented from the greyscale SoT |
| `#/experiments` | Experiments | stub |
| `#/experiments/:id` | Detail | stub |
| `#/history` | History | stub |
| `#/settings` | Settings | mute, reduced motion, five HARD LAW sentences |

Window: 960×640, min 720×480. Native titlebar. No glass, copper, or accent color.

## Out

MCP runtime, CA launch, fleet chrome, Ink Desk costume, 14-day clock (`clock_started` stays false).
