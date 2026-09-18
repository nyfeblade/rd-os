# Studio A — desktop shell

AI Coding Studio absorbs rd-os. Home is one immersive window: **Chat | Code | Board**, always visible. Waiting-table-as-home is dead.

This package is Electron so the same stranger path runs on **macOS and Windows**. Linux can use the same commands.

The board pane is a **stub**. It can read a local `attention.dump` fixture now and hook MCP later. It does not own the kernel.

## Stranger path

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os/studio/shell
npm install
npm start
```

A 1440×900 window titled **AI Coding Studio** should open with three panes on screen (no tab to reveal Code or Board).

| Platform | Command | What you get |
| --- | --- | --- |
| macOS | `npm start` | native window, hidden-inset titlebar |
| Windows | `npm start` | native window, 1440×900, min 1200×720 |
| either, browser chrome | `npm run preview` | same renderer at [http://127.0.0.1:5173](http://127.0.0.1:5173) |

`npm test` is a fence/smoke check (panes, connectors, presence, cutover copy, window size). It does not launch Electron.

## What should be on screen

1. **Chat** — seats/rooms, presence dots, **in-studio-only** chips on cutover seats, thread, composer
2. **Code** — repo tree + file preview (fixture)
3. **Board** — P0 / gates with Approve and Reject (stub dump; not a Waiting home)
4. **Connectors tray** — GitHub, CloudAgent, Notion, + connector
5. **Presence** — online count; list of who is in studio now

Connecting Notion (or + connector) asks once: *This seat works in Studio only while connected.*

## Layout

```
studio/shell/
  electron/          main + preload
  renderer/          three-pane chrome (Designer tokens)
  renderer/fixtures/ attention.dump stubs (no kernel)
  scripts/preview.js browser path
  scripts/smoke.js
```

Product SoT lives in `studio/design/` when that lane lands. Until then this shell follows the Designer three-pane mock: dark immersive, one accent (`#6b8afd`) on Send / Approve only.
