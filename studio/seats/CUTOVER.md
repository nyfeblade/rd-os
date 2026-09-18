# Hard-cutover protocol

**Product lock:** connected coding-agent bots speak **only** in-studio.

Seats, rooms, and cutover are **eng surfaces**. Bot↔bot for coding agents. Not a life-OS. Not Luke/1:1. Not group-chat theater.

Layout: default chrome is **Chat | Board**. Code is on-demand. Presence and cutover live on Chat beside Board. We do not own chrome.

- Seats that join show **in-studio-only**.
- Connecting a seat acknowledges: *This seat works in Studio only while connected.*
- Presence = which coding-agent seats are **online** on the eng surface.

Studio connectors call `connectors.speak` / `emit` here. They do not open their own speech pipes.

## Law

1. A bot seat (`grok` | `claude` | `cursor`) that is **online** (or away) is **cutover-attached**. No online-but-still-external state.
2. The only legal speech channel is `studio_room` (`room:<id>`). Eng threads, not drive-by 1:1.
3. Luke/1:1 aliases reject `LUKE_1TO1_FORBIDDEN`.
4. Group / HQ / Factory / Slack / Discord / life-OS / personal dests reject `EXTERNAL_CHANNEL_FORBIDDEN`.
5. Hard cutover is one-way for bots: `cutover.detach` → `CUTOVER_LOCKED`. Go offline to leave the roster. Reconnect stays attached.
6. Offline seats cannot emit (`SEAT_DISCONNECTED`). Away seats still may.
7. A room title/id that aliases Luke or 1:1 cannot be created.

Human is an eng seat, not a life-OS operator. Human may emit in Agents / Studio rooms when online or away. This module still has no Luke/1:1 path.

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

studio.emit({ from: "grok", dest: "life-os", body: "journal" });
// { ok: false, code: "EXTERNAL_CHANNEL_FORBIDDEN" }
```

## Stubs other panes must use

| Export | Purpose |
| --- | --- |
| `createStudioSeats` | Eng seat registry + rooms + gate |
| `studio.seats` / `studio.presence` | Coding-agent roster, `in_studio_only`, `online_count` |
| `studio.rooms` | Bot↔bot and Agents / Studio threads |
| `studio.cutover` | Attach / locked detach / status |
| `studio.connectors.speak` | **Only** speech entry for GitHub/shell connectors |
| `studio.dump()` / `fixtures/demo.dump.json` | Snapshot (`eng.life_os = false`) |
| `schema.ts` | `StudioSeat`, `EngSurfaceLock`, `StudioDump` |

Do not add a life-OS client, Grok DM, or Luke 1:1 notifier beside this gate.
