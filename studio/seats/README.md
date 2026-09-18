# studio/seats

Seat registry, presence, and in-studio rooms for **AI Coding Studio**.

Designer SoT (`studio/design`, PR #12): always **Chat · Code · Board**. Waiting-table-as-home is dead.

This module feeds **Chat** (seats / rooms + presence). It does **not** own shell chrome — no titlebar, connectors tray, or pane splitters.

**Fence:** `studio/seats/` only. Not CA1 experiment seats (`author|proof|human` on a packet).

**Product lock:** connected bots speak only in-studio. See [CUTOVER.md](CUTOVER.md).

## Stranger

```bash
cd studio/seats
npm test
```

No install. Node >= 18. Expect exit 0 and a measured line:

```
PASS studio/seats cutover (measured; cases=N passed=N failed=0; luke_1to1_leaks=0; wall_ms=…)
```

`clock_started` stays false. This is not a 14-day verdict.

Dump the Chat-pane fixture:

```bash
node bin/dump.js --out fixtures/demo.dump.json
```

## Import later (Chat pane — not chrome)

```ts
import type { StudioDump, StudioSeat, StudioRoom, ChatPaneHints } from "../seats/schema";
```

```js
const { createStudioSeats } = require("../seats");
const demo = require("../seats/fixtures/demo.dump.json");

const studio = createStudioSeats();
studio.seats.connect("grok"); // ack: "This seat works in Studio only while connected."
studio.seats.connect("claude");
studio.emit({ from: "grok", dest: "room:bots", body: "bot↔bot stays in Chat" });
```

Shell renders `demo.dump.json` or `studio.dump().data`: seat list + `in_studio_only` pill, rooms as Chat threads, `online_count`. Code and Board panes are out of scope here.

## Roster

| Seat | Kind | Notes |
| --- | --- | --- |
| `grok` | bot | general seat — not a project-specific Grok Bot |
| `claude` | bot | general seat |
| `cursor` | bot | general seat |
| `human` | human | Chat operator |

Presence (Designer dots): `online` | `away` | `offline`. Online and away are in-studio (may speak). Offline cannot.

Seed Chat rooms: `room:bots` (Bots), `room:chat` (Chat), `room:studio` (Studio).
