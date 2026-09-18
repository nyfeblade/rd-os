# Grok Bot ↔ Studio bridge

Elon / Grok Bot chat is the live Studio seat `provider=grok`. `elon` is an id alias. This package does not create Grok Bots.

Connections are UI clicks. The shell already holds a `createStudioSeats()` instance. It must not ask anyone to run a command.

## UI contract

Stranger path: one-click in Studio. Shell calls these APIs.

| Click | API |
| --- | --- |
| Import bot team | `importTeamRoster(studio)` |
| Connect Grok / Elon | `connectGrokSeat(studio)` or `connectGrokSeat(studio, "elon")` |
| List importable seats | `listImportableSeats()` |

```js
const {
  importTeamRoster,
  connectGrokSeat,
  listImportableSeats,
  createGrokBridge,
} = require("@rd-os/studio-grok-bot-bridge");

// Shell already has `studio` from createStudioSeats().
listImportableSeats();
importTeamRoster(studio);
connectGrokSeat(studio, "elon");
// { provider: "grok", cutover: true, in_studio_only: true, presence: "online" }

const bridge = createGrokBridge({ studio });
bridge.importTeamRoster();
bridge.connectGrokSeat("grok");
```

On connect, `seats.connect("grok")` hard-cutover attaches. Presence is `online` + `in_studio_only`. Speech is `studio_room` only. Merge / deploy / public still need HITL.

`elon` → `grok`. Importing the team registers Eng Lead, Eng Proof, Eng Ops, Eng Integrator, Eng Nightly, Studio Designer, Critiquito, Skillwright, Token Officer, and SOTA Software Engineer as bot seats. Elon maps onto the existing `grok` seat. Skipped: CTM Rater, Lingxi Engineer, eggbot.

Default stranger dump stays four seats until Import bot team is clicked.

## Proof

```bash
cd studio/bridge/grok-bot && npm test
cd studio/seats && npm test
```

Expect `seats.connect` cutover: grok/elon online `in_studio_only`; import list matches roster; operator 1:1 and external dests reject.

## Advanced MCP attach

Not the stranger path. Only for an agent that already speaks Studio MCP. Prefer `connectGrokSeat`.

Same seats protocol — no second wire. `attachGrokMcp(studio)` still calls `seats.connect("grok")`, then returns this spec (`fixtures/mcp.grok.advanced.json`). Do not paste this as the product happy path.

```
STUDIO_PROVIDER=grok node studio/mcp/server/bin.js
```
