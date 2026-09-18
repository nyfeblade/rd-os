# studio/marketplace

Discover, install, connect, and revoke eng capabilities inside Studio.

This package is the data layer. It does not paint Electron chrome. Shell opens Marketplace later from tray "+", Settings, or empty cold-open. Home stays Chat | Board.

**Fence:** `studio/marketplace/` only.

**Product lock:** eng-native catalog. Not a Grok Bot UI clone. Not a life-OS store.

SoT: [studio/design/MARKETPLACE.md](../design/MARKETPLACE.md). Cutover: [studio/seats/CUTOVER.md](../seats/CUTOVER.md). Tool matrix: [studio/connectors/CATALOG.md](../connectors/CATALOG.md).

## P0 catalog

| Id | Kind | Auth | Connect does |
| --- | --- | --- | --- |
| `claude` `grok` `cursor` `codex` `gemini` `chatgpt` | seat | required | Adds a coding-agent seat. Hard cutover. Speech only in `studio_room`. |
| `github` `slack` | connector | required | Two-way notify + reply. HITL on bot send / merge / public posts. |
| `studio-mcp` | mcp | none | First-party Studio MCP. Seats call in-studio tools. |

Modes and seat packs stay second. Linear, Sentry, Vercel, and life-OS connectors are not P0.

Install state is `available` | `needs_auth` | `live` | `error`.

## How to run the proof

Cold clone. Node >= 18. No credentials.

```bash
cd studio/marketplace
npm test
```

Expect exit 0 and a line:

```
PASS studio/marketplace (measured; cases=N passed=N failed=0; wall_ms=…)
```

`clock_started` stays false.

The run proves install to live to revoke for GitHub (install then connect), Studio MCP (install lands live), and Claude. State reloads from `state.json`. Secrets passed to `connect` are dropped.

## How to call it

```js
const { createStudioMarketplace } = require("@rd-os/studio-marketplace");

const market = createStudioMarketplace({ home: "/tmp/studio-marketplace" });
market.install("github");
market.connect("github");
market.revoke("github");
```

`connect(id)` means auth finished. Do not pass tokens. `connect(id, { error: "oauth_denied" })` stores the provider error string and moves the entry to `error`.

Browse tabs are `connectors` | `seats` | `modes`. Filters are `all` | `installed` | `available`. Empty installed copy is `Nothing installed — connect GitHub or Slack to start`.

Seat detail appends the cutover law. Connector `tools_pointer` is `studio/connectors/CATALOG.md#two-way-p0-wire`.

## Import later

```ts
import type { MarketplaceDump, MarketplaceEntry, InstallState } from "../marketplace/schema";
```
