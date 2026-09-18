# Studio A — desktop shell

Homebase for any AI developer: Grok Bot caps **optimized for engineering**, multi-provider, stranger cold-open. Waiting-table-as-home is dead.

Default chrome is **Chat + Board**. **Code is on demand**. **Visibility law:** only necessary info — current conversation, human gates, connector problems, Code entry. Full roster, full connector catalog, idle CA map, disconnected watches, and the mode parade stay hidden until needed.

**Connectors are two-way.** Tray states come from `studio/connectors/runtime` (`live` | `needs_auth` | `error` | `disconnected`). P0 **GitHub + Slack**: live/error are inbox entry; `needs_auth` opens connect; disconnected stays hidden. Ingest lands in Chat (PR/issue comments, Slack `app_mention` / DM) and Board when it needs a gate (review request, **CI@you**). The same composer replies **bound to** that notification. Bots send only with in-studio-only cutover **and** a human gate — no free-fire. Shell consumes runtime + ingress read-only; it does not implement those contracts. Quiet default: `need_you=false` (GitHub ping) never pings the tray. Token meter stub on Board + thread when known; omitted when unknown. Preview can toggle first-open vs working.

This package is Electron so the same stranger path runs on **macOS and Windows**. Linux can use the same commands.

The board pane is a **stub**. It can read a local `attention.dump` fixture now and hook MCP later. It does not own the kernel.

## Stranger path

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os/studio/shell
npm install
npm start
```

A 1440×900 window titled **AI Coding Studio** should open on Chat + Board with a stranger empty state: Connect GitHub and an agent. Code stays closed. Roster / full tray / idle CA are hidden. Sample gate: `npm run preview` then [http://127.0.0.1:5173/?fixture=human](http://127.0.0.1:5173/?fixture=human).

| Platform | Command | What you get |
| --- | --- | --- |
| macOS | `npm start` | native window, hidden-inset titlebar |
| Windows | `npm start` | native window, 1440×900, min 1200×720 |
| either, browser chrome | `npm run preview` | same renderer at [http://127.0.0.1:5173](http://127.0.0.1:5173) |

`npm test` is a fence/smoke check. It does not launch Electron.

## What should be on screen

1. **Chat** — current conversation (who + thread + composer). Full seat roster is hidden
2. **Board** — human gates only (“Needs you”). Idle CA map and disconnected watches are hidden
3. Toolbar **Code** (off) · **ConnectorsTray** for P0 GitHub + Slack: `live` / `error` are inbox filters; `needs_auth` opens connect; `disconnected` is hidden. Catalog **P0** is consumed read-only from `studio/connectors/CATALOG.md` when present. Slack is P1 in the catalog table and `p0_wire` yes. Idle catalog stays hidden
4. **Inbox** — GitHub comments + Slack `app_mention`/DM in Chat. Composer `bound_to` the active item (low-risk send, no HITL card). Board **HITL** pending card (payload + diff, Approve send) for high-risk egress. Bot high-risk also needs in-studio-only cutover
5. Connecting a seat or provider asks once: *This seat works in Studio only while connected.*

Code opens from the Code button or Close to put it away.

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
