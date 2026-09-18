# Studio A — desktop shell

Homebase for any AI developer: Grok Bot caps **optimized for engineering**, multi-provider, stranger cold-open. Waiting-table-as-home is dead.

Default chrome is **Chat + Board**. **Code is on demand** (not always-on). Titlebar: eng **mode** (build / proof / review) + **connectors tray** (catalog P0). Board: **agent map**, **Proof** gates, and **watches**.

This package is Electron so the same stranger path runs on **macOS and Windows**. Linux can use the same commands.

The board pane is a **stub**. It can read a local `attention.dump` fixture now and hook MCP later. It does not own the kernel.

## Stranger path

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os/studio/shell
npm install
npm start
```

A 1440×900 window titled **AI Coding Studio** should open on Chat + Board with a stranger empty state: talk to agents (You / Grok / Claude / Cursor), nothing blocked, connect a catalog P0 provider. Code stays closed. Sample gate: `npm run preview` then [http://127.0.0.1:5173/?fixture=human](http://127.0.0.1:5173/?fixture=human).

| Platform | Command | What you get |
| --- | --- | --- |
| macOS | `npm start` | native window, hidden-inset titlebar |
| Windows | `npm start` | native window, 1440×900, min 1200×720 |
| either, browser chrome | `npm run preview` | same renderer at [http://127.0.0.1:5173](http://127.0.0.1:5173) |

`npm test` is a fence/smoke check. It does not launch Electron.

## What should be on screen

1. **Chat** — You plus unconnected Grok / Claude / Cursor seats and an Agents room; **in-studio-only** on cutover seats; thread; composer
2. **Board** — Agent map + Proof instruments, empty gates until a dump, Approve and Reject when a human gate exists (not a Waiting home)
3. Toolbar **Code** (off) · **connectors tray** (catalog P0 from `studio/connectors/CATALOG.md`, all needs-auth) · presence (“N here”)
4. Connecting a seat or provider asks once: *This seat works in Studio only while connected.*

Code opens from the Code button, the chat hint, or Close to put it away.

## Layout

```
studio/shell/
  electron/                 main + preload
  lib/                      catalog + seats consume (read-only)
  renderer/                 quiet Chat + Board chrome
  renderer/chrome/          ConnectorsTray, ModesRail, PresenceBar
  renderer/panes/           ChatPane, BoardPane, CodeDrawer
  renderer/fixtures/        attention.dump stubs (no kernel)
  scripts/preview.js        browser path (+ /catalog.json)
  scripts/smoke.js
```

Reconciled Designer SoT lives in [`design/`](./design/) (`quiet-studio.html`, narrative, spec, layout lock). `studio/design/` and `studio/connectors/**` are consumed read-only — this lane does not write those paths.
