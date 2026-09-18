# Studio A — desktop shell

Homebase for any AI developer: Grok Bot caps **optimized for engineering**, multi-provider, stranger cold-open. Waiting-table-as-home is dead.

Default chrome is **Chat + Board**. **Code is on demand** (not always-on). Titlebar: eng **mode** (build / proof / review) + **connectors tray**. Board: **agent map**, **Proof** gates, and **watches**.

This package is Electron so the same stranger path runs on **macOS and Windows**. Linux can use the same commands.

The board pane is a **stub**. It can read a local `attention.dump` fixture now and hook MCP later. It does not own the kernel.

## Stranger path

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os/studio/shell
npm install
npm start
```

A 1440×900 window titled **AI Coding Studio** should open on Chat + Board. Code stays closed until you ask.

| Platform | Command | What you get |
| --- | --- | --- |
| macOS | `npm start` | native window, hidden-inset titlebar |
| Windows | `npm start` | native window, 1440×900, min 1200×720 |
| either, browser chrome | `npm run preview` | same renderer at [http://127.0.0.1:5173](http://127.0.0.1:5173) |

`npm test` is a fence/smoke check. It does not launch Electron.

## What should be on screen

1. **Chat** — seats, **in studio** chips on cutover seats, thread, composer
2. **Board** — CloudAgent + Proof instruments, gates / P0 with Approve and Reject (not a Waiting home)
3. Toolbar **Code** (off) · **connectors tray** (GitHub, CloudAgent, Notion) · presence (“N here”)
4. Connecting a seat or Notion asks once: *This seat works in Studio only while connected.*

Code opens from the Code button, the chat hint, or Close to put it away.

## Layout

```
studio/shell/
  electron/          main + preload
  renderer/          quiet Chat + Board chrome
  renderer/fixtures/ attention.dump stubs (no kernel)
  scripts/preview.js browser path
  scripts/smoke.js
```

Reconciled Designer SoT lives in [`design/`](./design/) (`quiet-studio.html`, narrative, spec). `studio/design/` is consumed read-only — this lane does not write that path.
