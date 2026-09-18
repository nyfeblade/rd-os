# Studio A — desktop shell

Homebase for any AI developer: Grok Bot caps **optimized for engineering**, multi-provider, stranger cold-open. Waiting-table-as-home is dead.

Default chrome is **Chat + Board**. **Code is on demand**. **Visibility law:** only necessary info — current conversation, human gates, connector problems, Code entry. Full roster, full connector catalog, idle CA map, disconnected watches, and the mode parade stay hidden until needed.

**Connectors are two-way.** Tray states come from `studio/connectors/runtime` (`live` | `needs_auth` | `error` | `disconnected`). P0 **GitHub + Slack**: live/error are inbox entry; `needs_auth` opens connect; disconnected stays hidden. Quiet-default: no wake/ping on FYI/ack — only **PR / Proof / FAIL / fence / HITL**. `need_you=false` never pings the tray. Token meters (TOKEN-UX): **seat** on the thread, **mission + per-seat** on the Board when known; omitted when unknown. Hard cutover chip: **in-studio only**. Proof VERIFIED is **Lead-merge** on the Board — no chat theater. Shell consumes `studio/connectors/ingress.ingest` → Inbox items for Chat/Board, plus runtime + `studio/design`, all read-only. Preview can toggle first-open vs working.

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

`npm test` is a fence/smoke check plus two proves. It does not launch Electron. `prove-chat` **fails** if Chat is still fixture-only (no bind, no `memory.write` persist). `prove-seat-connect` **fails** if Add seat → Connect is a no-op or still flips local renderer flags instead of `studio/seats` register + connect + cutover.attach.

Chat is **engine-backed**. On shell start / Chat pane mount the main process `require`s `studio/chat-engine`, binds the rd-os git toplevel (or a user-picked folder from the bind chip), restores or opens a thread, and paints `repo · branch · dirty` from the live snapshot. Composer send writes thread memory through the engine and survives reopen. Inbox-bound GitHub/Slack replies stay on the two-way path. Code remains a drawer; opening it pushes `focus.source = "code"` into the bound thread.

**Add seat is seats-backed.** Cold-open **Seat** opens a provider picker (`claude`, `grok`, `cursor`, `codex`, `gemini`, `chatgpt`). **Connect** calls `studio/seats` register → connect → cutover.attach. Success paints presence **online** + **in-studio-only**. Missing provider secrets (`ANTHROPIC_API_KEY`, `XAI_API_KEY`, `CURSOR_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` / `GOOGLE_API_KEY`) surface a toast and the connect sheet — never a silent no-op. The shell does not invent tokens and does not call vendor APIs without those env keys.

## What should be on screen

1. **Chat** — current conversation (who + thread + composer). Full seat roster is hidden
2. **Board** — human gates only (“Needs you”). Idle CA map and disconnected watches are hidden
3. Toolbar **Code** (off) · **ConnectorsTray** for P0 GitHub + Slack: `live` / `error` are inbox filters; `needs_auth` opens connect; `disconnected` is hidden. Catalog **P0** is consumed read-only from `studio/connectors/CATALOG.md` when present. Slack is P1 in the catalog table and `p0_wire` yes. Idle catalog stays hidden
4. **Inbox** — GitHub comments + Slack `app_mention`/DM in Chat. Composer `bound_to` the active item — **low-risk replies skip the HITL card**. Board **pending-approval** card (kind, destination, actor, payload + diff, Approve send / Deny) before high-risk egress. Bot high-risk also needs in-studio-only cutover
5. Connecting a seat or provider asks once: *This seat works in Studio only while connected.* After a real connect, presence lists the seat as online · in-studio-only. Auth/secret failures stay on screen.

Code opens from the Code button or Close to put it away.

## Layout

```
studio/shell/
  electron/                 main + preload (chat-engine IPC)
  lib/                      catalog + seats consume (read-only) + chat-bridge + seats-bridge
  renderer/                 quiet Chat + Board chrome
  renderer/chrome/          ConnectorsTray, ModesRail, PresenceBar
  renderer/panes/           ChatPane, BoardPane, CodeDrawer
  renderer/fixtures/        attention.dump stubs (board/inbox only)
  scripts/preview.js        browser path (+ /catalog.json + /chat/* + /seats/*)
  scripts/smoke.js
  scripts/prove-chat.js     bind + send must persist; fails on fixture-only Chat
  scripts/prove-seat-connect.js  Add seat → Connect must mutate studio/seats or show an error
```

Reconciled Designer SoT lives in [`design/`](./design/) (`quiet-studio.html`, narrative, spec, layout lock). `studio/design/` and `studio/connectors/**` are consumed read-only — this lane does not write those paths.
