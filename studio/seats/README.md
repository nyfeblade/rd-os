# studio/seats

Eng surfaces for **any AI developer studio**: seats, rooms, hard cutover. Multi-provider. Bot↔bot stays in-studio. Not a life-OS. Not a Luke-only fleet.

Default chrome is **Chat | Board**. Code is on-demand.

**Fence:** `studio/seats/` only. Distinct from CA1 packet seats. `studio/design/**` is read-only (bc-a7c450cd).

**Product lock:** connected coding-agent bots speak only in-studio. See [CUTOVER.md](CUTOVER.md).

## Stranger

Cold clone. No install. No fleet credentials. Node >= 18.

```bash
cd studio/seats
npm test
```

Expect exit 0:

```
PASS studio/seats cutover (measured; cases=N passed=N failed=0; operator_1to1_leaks=0; wall_ms=…)
```

`clock_started` stays false. Not a 14-day verdict.

```bash
node bin/dump.js --out fixtures/demo.dump.json
```

Default roster: `grok`, `claude`, `cursor`, `human`. Register any other provider:

```js
const { createStudioSeats } = require("./");
const studio = createStudioSeats();
studio.seats.register({ id: "gemini", kind: "bot", label: "Gemini" });
studio.seats.connect("gemini");
studio.emit({ from: "gemini", dest: "room:bots", body: "in-studio only" });
```

Dump: `north_star.audience=any_ai_developer_studio`, `eng.multi_provider=true`, `eng.luke_fleet_only=false`.

## Import later

```ts
import type { StudioDump, StudioSeat, NorthStar } from "../seats/schema";
```

## Default roster

| Seat | Kind | Agent |
| --- | --- | --- |
| `grok` | bot | coding_agent |
| `claude` | bot | coding_agent |
| `cursor` | bot | coding_agent |
| `human` | human | human — studio operator seat, any studio |

Presence: `online` | `away` | `offline`.

Seed rooms: `room:bots` (Bots), `room:chat` (Agents), `room:studio` (Studio).
