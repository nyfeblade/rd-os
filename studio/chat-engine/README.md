# studio/chat-engine

Chat is the **engine**. Board / dashboard is the **shell** — later, not this tree.

Kills paste-and-pray: the engine already knows the bound repo, live branch, dirty/clean, HEAD, recent commits, and focus path. The human does not paste diffs or logs that are in the snapshot.

## Fence

WRITE: `studio/chat-engine/**` only.

DO NOT TOUCH:

- `studio/shell/**` (PR#11 still open)
- `studio/chrome-craft/**`, `studio/sfx-engine/**`, `studio/connectors/**`
- `studio/craft/**`, `studio/design/**`, `studio/marketplace/**`
- `desktop/**`, `src/**`

No marketplace UI. No Linear / Sentry / Vercel chrome. No Board-as-home.

## First runnable slice

Node 18+. No `npm install`.

```bash
cd studio/chat-engine
npm test
node bin/demo.js /path/to/repo
```

`node bin/demo.js` with no path binds `cwd`'s git toplevel (from this package that is the rd-os repo). `--json` prints the same prove packet as machine JSON. `--home <dir>` persists threads so reopen is visible.

Expect: a thread id, bound git root, branch, dirty/clean, HEAD, coding-mode allow/deny, and the system line:

`assume workspace context is true; do not ask user to paste diffs/logs already in snapshot`

`life.food` prints `LIFE_OS_DENIED`. Handoff is a local dry-run with the snapshot attached. Memory counts survive a second `createChatEngine({ home })`.

## Owns (silent)

| Capability | What |
| --- | --- |
| Project bind | Every thread binds one local git root (optional extra roots). No orphan generic chat. |
| Live snapshot | repo path, branch, dirty/clean, HEAD SHA, last N commits. Refresh is git, not paste. |
| Focus pointer | Active file / last-touched path, confined to the repo, injected into the pack. |
| Memory | Thread + project notes persist under `home/` and survive reopen. |
| Coding mode | Default. Code toolbelt only. Life-OS denied. `web.browse` only if `asked: true`. |
| Handoff bus | `cursor_ca` / `claude_code` receive the same snapshot. Live APIs stay stub until secrets + a documented endpoint exist. `dry_run: true` is the local prove. |
| Outcome loop | CA / PR / CI events ingest into the thread. `poll` reads GitHub when a token exists; otherwise stub. |

Silent wires: local fs/repo · git · GitHub read · Cursor CA · Claude Code.

## Public API

```js
const { createChatEngine } = require("@rd-os/studio-chat-engine");
// or: require("../chat-engine") from another studio package after this lands

const engine = createChatEngine({ home: "./var/chat-engine" });
const opened = engine.threads.open({ repo: "/path/to/repo" });
const { data } = await engine.context.pack(opened.data.thread.id);
// data.snapshot.branch / dirty / head — already true
// data.pack.system includes ASSUME_SNAPSHOT_TRUTH
engine.tools.authorize(opened.data.thread.id, "life.food"); // LIFE_OS_DENIED
await engine.handoff.play(opened.data.thread.id, {
  target: "cursor_ca",
  brief: "fix the failing check",
  dry_run: true,
});
```

Closed sets: `MODES`, `TOOL_IDS`, `REJECT_CODES`, `HANDOFF_TARGETS`, `OUTCOME_SOURCES`. `describeReject` is exhaustive.

Coding-mode allowlist: `fs.*` · `git.*` · `github.*.read` · `handoff.cursor_ca` · `handoff.claude_code` · `test.run`.

Denied in coding mode: `life.*` · `fleet.ack` · `web.browse` unless `{ asked: true }`.

## What shell consumes later

PR#11 (`studio/shell`) does **not** implement this. After both land, Chat chrome should:

1. `require` this module — do not copy bind/snapshot/git
2. Open or restore a thread with a repo path (workspace root)
3. Render `snapshot.branch`, `dirty`, `head_short` on the thread header
4. Push `focus` when Code is open (`source: "code"`)
5. Send `context.pack()` as the model system/context, not a human paste
6. Call `handoff.play` instead of asking the user to copy a brief into Cursor CA / Claude Code
7. Append `outcomes.list` into the thread; Board may *display* the same events later

This PR does not import shell and does not draw Chat, Board, or a dashboard.

## Persist

Default home: `$CHAT_ENGINE_HOME` or `./var/chat-engine` (gitignored). Demo uses a temp dir unless `--home` is set.

```
{home}/threads/{thr_…}/thread.json
{home}/threads/{thr_…}/memory.json
{home}/threads/{thr_…}/events.json
{home}/projects/{hash}/project.json
{home}/projects/{hash}/memory.json
```

## Smoke

```bash
cd studio/chat-engine && npm test
```

Expect exit 0. Cases: bind → live snapshot (fixture + this repo) · focus · memory reopen · coding-mode denylist · handoff dry-run payload · outcome ingest.

`clock_started` stays false. `verdict` stays null. Not a 14-day PASS.
