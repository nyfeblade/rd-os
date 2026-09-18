# Studio MCP — connection behavior

SoT for how a coding-agent MCP client becomes a Studio seat. Product lock: [`../seats/CUTOVER.md`](../seats/CUTOVER.md). HITL: [`../design/HITL.md`](../design/HITL.md). Ingress vs egress: [`../connectors/ARCHITECTURE.md`](../connectors/ARCHITECTURE.md).

`verdict` stays null. `clock_started` stays false.

## On connect

MCP `initialize` **is** connect. The stdio process does not occupy a seat until handshake.

1. Resolve `STUDIO_PROVIDER` / `createStudioMcpServer({ provider })` against the registry (ids + labels only).
2. `seats.register({ id, kind: "bot", label })` — idempotent if the seat already exists (`claude` / `grok` / `cursor` are seeded; `codex` / `gemini` / `chatgpt` are registered on first connect).
3. `seats.connect(id)` — hard cutover. An online bot is **attached**. No online-but-still-external state.
4. Seat shows `presence: "online"`, `cutover: "attached"`, `in_studio_only: true`.
5. Client is acknowledged with: *This seat works in Studio only while connected.*

Legal speech after connect is `studio_room` (`room:<id>`) only. Operator/1:1 and external/life-OS dests stay rejected by seats. This MCP server does **not** expose an emit/speak tool — chrome / connectors.speak own that path.

`tools/list` and `tools/call` before `initialize` reject `NOT_CONNECTED`.

## On disconnect

Any of: MCP `shutdown`, `notifications/exit`, stdin `end`/`close`, `SIGINT`/`SIGTERM`, or `server.disconnect()`.

1. `seats.disconnect(id)` → `presence: "offline"`.
2. Offline seats cannot emit (`SEAT_DISCONNECTED`).
3. Hard cutover stays **attached**. Reconnect does not offer an external channel. Detach on a bot is `CUTOVER_LOCKED` (go offline to leave the roster; reconnect stays attached).

## Provider registry

Ids + labels only. Not a vendor MCP host list.

| id | label |
| --- | --- |
| `claude` | Claude |
| `grok` | Grok |
| `cursor` | Cursor |
| `codex` | Codex |
| `gemini` | Gemini |
| `chatgpt` | ChatGPT |

Unknown ids (`luke`, `slack`, …) fail construct / stdio boot with `UNKNOWN_PROVIDER`. Reserved operator / life-OS slugs are also rejected by `seats.register` if they ever reach it.

## Tool permission matrix

Every cell is explicit. Adding a provider without a cell is a hard fail (`assertMatrixComplete` / missing-cell throw).

| Tool | claude | grok | cursor | codex | gemini | chatgpt |
| --- | --- | --- | --- | --- | --- | --- |
| `studio.seats.list` | allow | allow | allow | allow | allow | allow |
| `studio.seats.presence` | allow | allow | allow | allow | allow | allow |
| `studio.chat.snapshot` | allow | allow | allow | allow | allow | allow |
| `studio.board.list_gates` | allow | allow | allow | allow | allow | allow |
| `studio.repo.bind_info` | allow | allow | allow | allow | allow | allow |
| `studio.merge` | HITL | HITL | HITL | HITL | HITL | HITL |
| `studio.deploy` | HITL | HITL | HITL | HITL | HITL | HITL |
| `studio.db.mutate` | HITL | HITL | HITL | HITL | HITL | HITL |
| `studio.public_post` | HITL | HITL | HITL | HITL | HITL | HITL |

`allow` tools appear in `tools/list`. HITL names are **not** listed. Calling them still returns `{ ok: false, code: "HITL_REQUIRED" }` so a confused client cannot silently merge, deploy, mutate a DB, or public-post.

`deny` is reserved for a later per-provider shrink. Do not invent extra tools to fill the matrix.

## HITL still required

Board Approve (payload + diff) remains law for:

| Class | Examples |
| --- | --- |
| Merge | GitHub merge, GitLab MR merge |
| Deploy | Vercel promote, Cloudflare Worker / DNS / cache write |
| DB | Supabase / Neon / Prisma SQL, migration, branch merge |
| Public post | Slack channel post, GitHub comment from a **bot** |

Bot public post also needs cutover attached. Human thread-bound replies are a different path (composer, not this server). A green MCP read is not a verdict and does not skip HITL.

`studio.board.list_gates` is unbound in this fence (`gates: []` + TODO). That is **not** an empty-board approval. Absence of a gate row is not Approve.

## Chat snapshot bind

`studio.chat.snapshot` requires `../../chat-engine` (sibling, documented public API). It opens or reuses a thread bound to `STUDIO_REPO` / cwd and returns `engine.snapshot.refresh` — live git, not paste. If chat-engine later moves or stops exporting `createChatEngine`, fail closed (do not invent a transcript).

Do not import `studio/shell`.

## Env

| Variable | Required | Role |
| --- | --- | --- |
| `STUDIO_PROVIDER` | stdio yes | Registry id for this seat |
| `STUDIO_HOME` | no | Seats `state.json` home |
| `STUDIO_REPO` | no | Bind path for chat snapshot + `repo.bind_info` |
| `CHAT_ENGINE_HOME` | no | Chat-engine persist; default `$STUDIO_HOME/chat-engine` or a temp dir |
