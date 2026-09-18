# Hard-cutover protocol

**Product lock:** connected coding-agent bots speak **only** in-studio.

For **any** AI developer studio. Multi-provider. Not a Luke-fleet. Seats/rooms/cutover are eng surfaces. Not a life-OS.

Default chrome is **Chat | Board**. Code is on-demand.

- Seats that join show **in-studio-only**.
- Connecting a seat acknowledges: *This seat works in Studio only while connected.*
- Presence = which provider seats are online on the eng surface.

Connectors call `connectors.speak` / `emit` here. No private operator 1:1 pipe.

## Law

1. An online (or away) bot seat is cutover-attached. No online-but-still-external state.
2. The only legal speech channel is `studio_room` (`room:<id>`).
3. Operator/1:1 aliases reject `OPERATOR_1TO1_FORBIDDEN` (includes `owner`, `operator`, `dm:human`, and `luke` as one alias — not a fleet requirement).
4. Group / Slack / Discord / life-OS dests reject `EXTERNAL_CHANNEL_FORBIDDEN`.
5. Bot `cutover.detach` → `CUTOVER_LOCKED`. Go offline to leave the roster. Reconnect stays attached.
6. Offline seats cannot emit. Away seats still may.
7. Rooms cannot alias operator/1:1 or life-OS.

Register more providers with `seats.register({ id, kind: "bot"|"human", label })`. Same cutover.

## Call

```js
const { createStudioSeats } = require("@rd-os/studio-seats");
const studio = createStudioSeats();

studio.connect("gemini");
// { provider: "gemini", connected_at, tools_allowed, cutover: true }

studio.emit({ from: "gemini", dest: "room:bots", body: "in-studio-only" });
// { ok: true }

studio.emit({ from: "gemini", dest: "operator", body: "status ping" });
// { ok: false, code: "OPERATOR_1TO1_FORBIDDEN" }
```

## Connection behavior

What `connect(provider)` **does** (and does not):

| Step | Effect |
| --- | --- |
| Register if needed | Known providers (`claude`, `grok`, `cursor`, `codex`, `gemini`, `chatgpt`) land on the roster. Unknown slugs stay `UNKNOWN_SEAT`. Default roster is still `grok` / `claude` / `cursor` / `human`. |
| `cutover.attach` | Online implies attached. No online-but-still-external state. |
| Presence | `online` + `in_studio_only`. Pill copy stays `CONNECT_ACK`. |
| Record | `{ provider, connected_at, tools_allowed, cutover: true }` |
| Speech | `chat.emit` is room-only. External channel → `EXTERNAL_CHANNEL_FORBIDDEN`. Operator 1:1 → `OPERATOR_1TO1_FORBIDDEN`. |
| Tools | Default `tools_allowed`: `chat.emit`, `board.read`, `repo.read`. `merge` / `deploy` / `public` always need HITL. |
| Disconnect | `offline`. Detach while online → `CUTOVER_LOCKED`. Reconnect stays attached. |

## Stubs other panes must use

| Export | Purpose |
| --- | --- |
| `createStudioSeats` | Multi-provider registry + rooms + gate |
| `studio.connect` / `studio.seats.connect` | Register if needed → attach → `{ provider, connected_at, tools_allowed, cutover: true }` |
| `studio.seats.register` | Add a provider seat |
| `studio.permissions` | Default tools + HITL gate for merge/deploy/public |
| `studio.presence` | Roster, `in_studio_only`, `online_count` |
| `studio.rooms` | Bot↔bot / Agents / Studio |
| `studio.cutover` | Attach / locked detach |
| `studio.connectors.speak` | Only speech entry for connectors |
| `studio.dump()` | Snapshot (`north_star.stranger_usable`) |
