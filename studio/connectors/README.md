# studio/connectors

Source of truth for the Studio **connectors tray**: which eng tools exist, how they attach (MCP / public API / CLI / connector), and the official docs URL.

| Path | Role |
| --- | --- |
| [`CATALOG.md`](CATALOG.md) | **SoT.** P0 / P1 / P2 tool rows plus two-way columns (`ingest` \| `reply` \| `bot_send` \| `tray_state`). Shell and seats **read** this file. |
| [`runtime/`](runtime/) | P0 GitHub + Slack contracts: ingest → inbox; human/bot reply. Prove with `node studio/connectors/runtime/prove.js`. |

## Shell consume-only

The Studio chrome (`connectors ▾` in `studio/design/STUDIO-SHELL-SPEC.md`) **consumes** this catalog. It must not invent tools, invent endpoints, or write credentials back into this tree.

- Tray state (`live` / `needs_auth` / `error` / `idle`) lives in the seat/session. Pass it into `runtime.ingest` / `runtime.reply`; do not write credentials here.
- Inbox + reply-composer: Chat/Board consume `runtime` inbox items and send `reply(draft)` through this module. Bot send uses the `humanGateAllows` hook.
- A missing official URL is `UNVERIFIED` — do not guess a host.
- This lane owns `studio/connectors/**` only. Do not edit `studio/shell`, `studio/seats`, `studio/github`, or kernel paths from here.

## How to add a tool

1. Research the **vendor's official** MCP or docs page. Fetch it. Do not copy marketplace blogs.
2. Append one row to `CATALOG.md` with: name, priority (`P0`/`P1`/`P2`), type (`MCP` \| `API` \| `CLI` \| `connector`), official URL, public auth summary, one-line tray use.
3. If the official MCP/docs URL cannot be confirmed, put `UNVERIFIED` in the URL cell and say what was checked.
4. Prefer the vendor's primary surface as `type`. A tool may also have an API or CLI; do not add a second row unless it is a distinct tray entry (for example Datadog vs Grafana).
5. For a P0-wired two-way provider, add a `runtime/providers/<name>.js` ingest/reply pair plus good/planted fixtures, and a two-way table row (`ingest` \| `reply` \| `bot_send` \| `tray_state` \| `p0_wire`). Do not invent REST/MCP paths.
6. Open a PR that touches **only** `studio/connectors/**`.
