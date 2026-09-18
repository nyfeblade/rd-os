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

Default roster: `grok`, `claude`, `cursor`, `human`. `connect(provider)` registers a known coding-agent provider if needed (`claude`, `grok`, `cursor`, `codex`, `gemini`, `chatgpt`). Register any other slug:

```js
const { createStudioSeats } = require("./");
const studio = createStudioSeats();
studio.connect("gemini");
// { provider: "gemini", connected_at, tools_allowed: ["chat.emit","board.read","repo.read"], cutover: true }
studio.emit({ from: "gemini", dest: "room:bots", body: "in-studio only" });
```

Dump: `north_star.audience=any_ai_developer_studio`, `eng.multi_provider=true`, `eng.luke_fleet_only=false`.

## Team roster (opt-in)

Existing bots import as Studio seats. Not new Grok Bots. Default dump stays four seats until UI calls `importRoster()`.

```js
const { createStudioSeats, listImportableSeats } = require("./");
const studio = createStudioSeats();
studio.importRoster();
studio.listImported();
listImportableSeats();
```

Elon aliases to live provider `grok`. Skipped: CTM Rater, Lingxi Engineer, eggbot.

## Import later

```ts
import type { StudioDump, StudioSeat, NorthStar, ImportedSeat } from "../seats/schema";
```

## Default roster

| Seat | Kind | Agent |
| --- | --- | --- |
| `grok` | bot | coding_agent |
| `claude` | bot | coding_agent |
| `cursor` | bot | coding_agent |
| `human` | human | human — studio operator seat, any studio |

Presence: `online` | `away` | `offline`.

Known connectable providers (not seeded until connect): `codex`, `gemini`, `chatgpt`.

Seed rooms: `room:bots` (Bots), `room:chat` (Agents), `room:studio` (Studio).

## Connection behavior

`connect(provider)` **does**:

1. Register the seat if it is a known provider and not yet on the roster.
2. `cutover.attach` — no online-but-still-external state.
3. Presence becomes `online` with `in_studio_only: true`.
4. Return `{ provider, connected_at, tools_allowed, cutover: true }`.

`connect` does **not**:

- Open Slack / Discord / operator 1:1.
- Grant merge / deploy / public without a HITL flag.
- Unlock `cutover.detach` while the seat is online.

`disconnect(provider)` → `offline`. Speech stops (`SEAT_DISCONNECTED`). Cutover stays attached; reconnect stays in-studio-only. `cutover.detach` while online → `CUTOVER_LOCKED`.

Default `tools_allowed`: `chat.emit` (room-only), `board.read`, `repo.read`. High-risk `merge` / `deploy` / `public` always need HITL.
