# studio/mcp — first-party Studio MCP

**Product:** [AI Coding Studio](../design/PRODUCT-NARRATIVE.md) (Electron). Not R&D OS. Not Waiting-table.

Coding agents (Claude, Grok, Cursor, Codex, Gemini, ChatGPT) connect **into** Studio over MCP and use Studio tools. This tree is the inbound server. It is not a tray of vendor MCPs.

**Fence:** `studio/mcp/**` only.

**Product lock:** a connected bot seat is **in-studio-only**. Hard cutover is law ([`../seats/CUTOVER.md`](../seats/CUTOVER.md)). Merge / deploy / DB / public post still require HITL ([`../design/HITL.md`](../design/HITL.md)).

`verdict` stays null. `clock_started` stays false.

## What this server exposes

Closed tool surface (stdio JSON-RPC, Node 18+, no `npm install`):

| Tool | Live? | What |
| --- | --- | --- |
| `studio.seats.list` | yes | Seat roster from [`../seats`](../seats) |
| `studio.seats.presence` | yes | `online` / `away` / `offline`, `in_studio_only`, `online_count` |
| `studio.chat.snapshot` | yes | Sibling [`../chat-engine`](../chat-engine) bind + live git snapshot (branch, dirty, HEAD, commits). Not a chrome transcript. |
| `studio.board.list_gates` | **stub** | Empty `gates: []` + explicit TODO. No planted Board rows. No `studio/shell` scrape. |
| `studio.repo.bind_info` | yes | Git toplevel + branch via chat-engine `resolveGitRoot` |

Connection lifecycle, permission matrix, and HITL: [`CONNECTION.md`](CONNECTION.md).

## Connection model

One MCP child process = one coding-agent seat.

```
Agent (Claude / Grok / Cursor / Codex / Gemini / ChatGPT)
    │  MCP stdio (JSON-RPC 2.0, Content-Length or newline JSON)
    ▼
studio/mcp/server
    │  initialize
    ├─► seats.register({ id, kind: "bot", label })
    └─► seats.connect(id)  → online + cutover.attached + in-studio-only
    │
    │  tools/call  (permission matrix by provider)
    ▼
Studio surfaces (seats, presence, chat-engine snapshot, board stub, repo bind)
    │
    │  shutdown / stdin end / SIGTERM
    └─► seats.disconnect(id) → offline (cutover stays attached)
```

`STUDIO_PROVIDER` is required for the stdio binary. Legal ids: `claude` · `grok` · `cursor` · `codex` · `gemini` · `chatgpt`.

```bash
STUDIO_PROVIDER=claude STUDIO_HOME=./var/studio node server/bin.js
```

Attach from an MCP client (Cursor example — same shape for Claude Code / Codex / Gemini CLI):

```json
{
  "mcpServers": {
    "ai-coding-studio": {
      "command": "node",
      "args": ["studio/mcp/server/bin.js"],
      "env": {
        "STUDIO_PROVIDER": "cursor",
        "STUDIO_HOME": "./var/studio",
        "STUDIO_REPO": "."
      }
    }
  }
}
```

`STUDIO_HOME` persists seats (`state.json`) so a later Studio desktop can share the roster. Unset = in-memory seats + temp chat-engine home.

### One-click attach (no path paste)

Strangers should not hand-write the absolute path to `server/bin.js`. `host.js` resolves it and emits the client config, so Studio (or a script) can surface a copy-paste-ready block:

```js
const { attachConfigJson } = require("@rd-os/studio-mcp"); // or require("../mcp")

process.stdout.write(attachConfigJson({ provider: "cursor", home: "./var/studio", repo: "." }));
// {
//   "mcpServers": {
//     "ai-coding-studio": {
//       "command": "node",
//       "args": ["/abs/path/to/studio/mcp/server/bin.js"],
//       "env": { "STUDIO_PROVIDER": "cursor", "STUDIO_HOME": "./var/studio", "STUDIO_REPO": "." }
//     }
//   }
// }
```

`attachEntry` / `attachConfig` return the same shape as objects. `home`/`repo` are omitted from `env` when not given, and an unknown provider throws `UNKNOWN_PROVIDER`. This does not start a process or take a seat — `initialize` over stdio still connects.

## Stranger

Cold clone. No install. No fleet credentials. Node >= 18.

```bash
cd studio/mcp
npm test
```

Expect exit 0:

```
PASS studio/mcp (measured; cases=N passed=N failed=0; wall_ms=…)
```

## Import

```js
const { createStudioMcpServer, PROVIDERS, TOOLS } = require("@rd-os/studio-mcp");
// or: require("../mcp") from another studio package

const server = createStudioMcpServer({ provider: "claude", home, repo });
await server.handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
```

## Anti-goals

This server is **Studio inbound**. It does not clone, wrap, or re-host community / archived vendor MCPs. Denylist: [`../connectors/DO-NOT-SHIP.md`](../connectors/DO-NOT-SHIP.md).

| Do not ship here | Why |
| --- | --- |
| `@modelcontextprotocol/server-github` / `server-slack` / `server-sentry` | Archived reference stdio binaries |
| `jerhadf/linear-mcp*` | Community / deprecated; official is `https://mcp.linear.app/mcp` |
| Community Cloudflare / Supabase wrappers | Official hosts only, in the connectors catalog — not this tree |
| Legacy `/sse` transports | Streamable HTTP `/mcp` is the tray path; this server is local stdio |
| `src/mcp-server.js` / `bin/mcp.js` (rd-os kernel) | R&D OS / Waiting / experiment tools. Different product |
| Connector webhook ingress | MCP is **not** the webhook path ([`../connectors/ARCHITECTURE.md`](../connectors/ARCHITECTURE.md)) |
| Merge / deploy / DB / public-post tools | HITL. Board Approve. Not silent MCP writes |
| Life-OS / operator 1:1 / fleet theater | Hard cutover rejects those dests in seats |

Vendor MCPs (GitHub, Linear, Sentry, …) stay in [`../connectors/CATALOG.md`](../connectors/CATALOG.md) as tray egress. Studio orchestrates; it does not wrap every vendor in a second agent loop.

## Out of this fence

- `studio/shell/**` — chrome
- `studio/chat-engine/**` — read/import only
- `studio/connectors/runtime/**`
- `desktop/**`, `src/**`
