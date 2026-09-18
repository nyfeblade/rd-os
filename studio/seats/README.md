# studio/seats

Eng surfaces for **coding agents**: seats, rooms, hard cutover. Bot↔bot speech stays in-studio. Not a life-OS.

**Layout lock:** default chrome is **Chat | Board**. Code is on-demand. Three-pane-always is wrong.

This module feeds Chat (eng seats / rooms + presence) beside Board. It does **not** own shell chrome. `studio/design/**` is read-only (bc-a7c450cd).

**Fence:** `studio/seats/` only. Distinct from CA1 experiment seats (`author|proof|human` on a packet).

**Product lock:** connected coding-agent bots speak only in-studio. See [CUTOVER.md](CUTOVER.md).

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

```bash
node bin/dump.js --out fixtures/demo.dump.json
```

## Import later (Chat pane — not chrome)

```ts
import type { StudioDump, StudioSeat, StudioRoom, EngSurfaceLock } from "../seats/schema";
```

```js
const { createStudioSeats } = require("../seats");
const demo = require("../seats/fixtures/demo.dump.json");

const studio = createStudioSeats();
studio.seats.connect("grok");
studio.seats.connect("claude");
studio.emit({ from: "grok", dest: "room:bots", body: "bot↔bot stays in-studio" });
```

Dump: `eng.domain=eng`, `eng.life_os=false`, `eng.purpose=coding_agent_bot_bot`. Seats carry `surface: eng` and `agent: coding_agent|human`.

## Roster

| Seat | Kind | Agent |
| --- | --- | --- |
| `grok` | bot | coding_agent — general seat, not a project-specific Grok Bot |
| `claude` | bot | coding_agent |
| `cursor` | bot | coding_agent |
| `human` | human | human — eng, not a life-OS persona |

Presence: `online` | `away` | `offline`. Online and away may speak. Offline cannot.

Seed rooms (eng): `room:bots` (Bots), `room:chat` (Agents), `room:studio` (Studio).
