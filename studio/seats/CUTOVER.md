# Hard-cutover protocol

**Product lock:** connected bots speak **only** in-studio.

Designer SoT UX (Chat pane — we do not own chrome):

- Seats that join show **in-studio-only** (field + chip label).
- Connecting a seat acknowledges: *This seat works in Studio only while connected.*
- Presence list = who’s **online** in studio now (`online` | `away` | `offline`).

This module is the enforcement point. Studio connectors (GitHub pane, shell tray, future adapters) do not open their own speech pipes. They call `connectors.speak` / `emit` here.

## Law

1. A bot seat (`grok` | `claude` | `cursor`) that is **online** (or away) is **cutover-attached**. There is no online-but-still-external state.
2. The only legal speech channel is `studio_room` (`room:<id>`). Chat threads, not drive-by 1:1.
3. Luke/1:1 aliases are never a destination. Reject `LUKE_1TO1_FORBIDDEN`. Studio must not grow an external Luke spam path.
4. Group / HQ / Factory / Slack / Discord / connector DMs reject `EXTERNAL_CHANNEL_FORBIDDEN`.
5. Hard cutover is one-way for bots: `cutover.detach` → `CUTOVER_LOCKED`. Go offline to leave the Chat list as disconnected. Reconnect stays attached.
6. Offline seats cannot emit (`SEAT_DISCONNECTED`). Away seats still may — they are in studio.
7. A room title/id that aliases Luke or 1:1 cannot be created.

Human seat is the Chat operator. Human may speak in Chat / Studio rooms when online or away. Human still cannot use this module to reach Luke/1:1 — the connector path does not exist.

## Call

```js
const { createStudioSeats } = require("@rd-os/studio-seats");
const studio = createStudioSeats({ home: "/tmp/studio-seats" });

studio.cutover.attach("grok");
studio.seats.connect("grok");
// { ok: true, data: { seat, ack: "This seat works in Studio only while connected.", in_studio_only: true } }

studio.emit({ from: "grok", dest: "room:bots", body: "in-studio-only" });
// { ok: true, data: { message, room } }

studio.emit({ from: "grok", dest: "luke_1to1", body: "status ping" });
// { ok: false, code: "LUKE_1TO1_FORBIDDEN" }

studio.connectors.speak({ connector: "github", from: "cursor", dest: "luke", body: "PR opened" });
// { ok: false, code: "LUKE_1TO1_FORBIDDEN" }
```

## Stubs other panes must use

| Export | Purpose |
| --- | --- |
| `createStudioSeats` | Registry + presence + rooms + gate |
| `studio.seats` / `studio.presence` | Chat list: seats, dots, `in_studio_only`, `online_count` |
| `studio.rooms` | Chat threads (Bots / Chat / Studio) |
| `studio.cutover` | Attach / locked detach / status |
| `studio.connectors.speak` | **Only** speech entry for GitHub/shell connectors |
| `studio.dump()` / `fixtures/demo.dump.json` | Chat-pane snapshot (`chat.chrome = not-owned`) |
| `schema.ts` | Types (`StudioSeat`, `StudioDump`, `ChatPaneHints`) |

Do not add a parallel chat client, Grok DM, or Luke 1:1 notifier beside this gate. Do not implement titlebar / tray / pane chrome here.
