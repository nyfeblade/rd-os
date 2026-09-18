# studio/connectors

Source of truth for the Studio **connectors tray**: which eng tools exist, how they attach (MCP / public API / CLI / connector), and the official docs URL.

| Path | Role |
| --- | --- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | **Integration blueprint.** Ingress (webhook → ingest schema → inbox) vs egress (MCP or REST/GraphQL + HITL). Wire order after GitHub+Slack. |
| [`CATALOG.md`](CATALOG.md) | **SoT.** P0 / P1 / P2 tool rows plus two-way columns (`ingest` \| `reply` \| `bot_send` \| `tray_state`). Shell and seats **read** this file. |
| [`DO-NOT-SHIP.md`](DO-NOT-SHIP.md) | Appendix. Archived `modelcontextprotocol/servers` github/slack/sentry, `jerhadf/linear-mcp*`, community CF/Supabase wrappers, legacy `/sse` 410. |
| [`runtime/`](runtime/) | P0 GitHub + Slack contracts: ingest → inbox; human/bot reply. Prove with `node studio/connectors/runtime/prove.js`. |

## Shell consume-only

The Studio chrome (`connectors ▾` in `studio/design/STUDIO-SHELL-SPEC.md`) **consumes** this catalog. It must not invent tools, invent endpoints, or write credentials back into this tree.

- Tray state (`live` / `needs_auth` / `error` / `disconnected`) lives in the seat/session. Pass it into `runtime.ingest` / `runtime.reply`; do not write credentials here.
- Inbox + reply-composer: Chat/Board consume `runtime` inbox items. The composer is bound to the active notification (`bound_to`), not a global outbox. Bot send requires `cutoverAllows` (in-studio-only attached) **and** `humanGateAllows`.
- A missing official URL is `UNVERIFIED` — do not guess a host. Do not cite 404s. Archived / community / `/sse` go in `DO-NOT-SHIP.md`.
- This lane owns `studio/connectors/**` only. Do not edit `studio/shell`, `studio/seats`, `studio/github`, or kernel paths from here.
- Do not implement the webhook gateway here. That is the next fence: `studio/connectors/ingress/**`.

## How to add a tool

1. Research the **vendor's official** MCP or docs page. Fetch it. Do not copy marketplace blogs.
2. Append one row to `CATALOG.md` with: name, priority (`P0`/`P1`/`P2`), type (`MCP` \| `API` \| `CLI` \| `connector`), official URL, public auth summary, one-line tray use.
3. If the official MCP/docs URL cannot be confirmed, put `UNVERIFIED` in the URL cell and say what was checked. Fetch the URL. No 404s. Legacy `/sse` and archived/community binaries go in `DO-NOT-SHIP.md`, not the tray table.
4. Prefer the vendor's primary surface as `type`. A tool may also have an API or CLI; do not add a second row unless it is a distinct tray entry (for example Datadog vs Grafana). Ingress (webhook) vs egress (MCP/REST) is [`ARCHITECTURE.md`](ARCHITECTURE.md) — do not treat MCP as a webhook.
5. For a P0-wired two-way provider, add a `runtime/providers/<name>.js` ingest/reply pair plus good/planted fixtures, and a two-way table row (`ingest` \| `reply` \| `bot_send` \| `tray_state` \| `p0_wire`). Do not invent REST/MCP paths. Follow the wire order in `ARCHITECTURE.md`.
6. Open a PR that touches **only** `studio/connectors/**`.
