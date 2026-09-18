# studio/seats

Seat registry, presence, in-studio rooms, and hard-cutover speech gate for AI Coding Studio.

**Fence:** this directory only. Not CA1 experiment seats (`author|proof|human` on a packet). Those stay in `src/board`.

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

Dump the shell fixture:

```bash
node bin/dump.js --out fixtures/demo.dump.json
```

## Import later (other panes)

```ts
import type { StudioDump, StudioSeat, StudioRoom } from "../seats/schema";
```

```js
const { createStudioSeats } = require("../seats");
const demo = require("../seats/fixtures/demo.dump.json");

const studio = createStudioSeats();
studio.seats.connect("grok");
studio.seats.connect("claude");
studio.emit({ from: "grok", dest: "room:bots", body: "bot↔bot stays on the floor" });
```

Left pane (shell) can render `demo.dump.json` or `studio.dump().data` without importing kernel MCP.

## Roster

| Seat | Kind | Notes |
| --- | --- | --- |
| `grok` | bot | general seat — not a project-specific Grok Bot |
| `claude` | bot | general seat |
| `cursor` | bot | general seat |
| `human` | human | desk operator |

Presence is `connected` | `disconnected`. Seed rooms: `room:bots` (bot↔bot), `room:floor` (all), `room:desk` (human+bots).
