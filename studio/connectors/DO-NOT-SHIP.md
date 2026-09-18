# DO-NOT-SHIP — connectors appendix

Denylist for the Studio tray. Official replacements live in [`CATALOG.md`](CATALOG.md). Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md).

Fetched 2026-09-18. A row is here because it is **archived**, **community/unofficial**, or a **legacy `/sse` transport**. Do not add these URLs to the catalog. Do not configure seats with them.

`verdict` stays null. `clock_started` stays false.

---

## Archived `modelcontextprotocol/servers` (github / slack / sentry)

Source: [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) README → [servers-archived](https://github.com/modelcontextprotocol/servers-archived) (repo archived 2025-05-29). Paths below are **200**.

| Do not ship | Why | Ship instead |
| --- | --- | --- |
| `@modelcontextprotocol/server-github` · [servers-archived/src/github](https://github.com/modelcontextprotocol/servers-archived/tree/main/src/github) | Archived reference. Known-stale PAT stdio. | [github/github-mcp-server](https://github.com/github/github-mcp-server) · `https://api.githubcopilot.com/mcp/` |
| `@modelcontextprotocol/server-slack` · [servers-archived/src/slack](https://github.com/modelcontextprotocol/servers-archived/tree/main/src/slack) | Archived reference (stdio + bot token). **Not** Slack's hosted MCP. | Official Slack MCP `https://mcp.slack.com/mcp` ([docs](https://docs.slack.dev/ai/slack-mcp-server)). Ingress stays Events API / Bolt. |
| `@modelcontextprotocol/server-sentry` · [servers-archived/src/sentry](https://github.com/modelcontextprotocol/servers-archived/tree/main/src/sentry) | Archived reference. | [getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp) · `https://mcp.sentry.dev/mcp` |

Also archived in the same tree (do not ship if a later tray row appears): GitLab / Postgres / Puppeteer reference servers. Official GitLab is instance `/api/v4/mcp`, not the archived stdio package.

Zencoder's fork of the Slack reference server ([zencoderai/slack-mcp-server](https://github.com/zencoderai/slack-mcp-server), 200) is still **not** Slack-official. Tray uses `mcp.slack.com` or Bolt.

---

## `jerhadf/linear-mcp` (community Linear)

| Checked | HTTP | Notes |
| --- | --- | --- |
| `https://github.com/jerhadf/linear-mcp` | **404** | Name in older briefs. Do not cite. |
| [jerhadf/linear-mcp-server](https://github.com/jerhadf/linear-mcp-server) | **200** | README: **deprecated**. Points at Linear's remote MCP. |

Ship: [linear.app/docs/mcp](https://linear.app/docs/mcp) · `https://mcp.linear.app/mcp` (GET 401 without OAuth). Do **not** ship `https://mcp.linear.app/sse` — **404** on 2026-09-18.

---

## Community Cloudflare / Supabase wrappers

Official only:

| Vendor | Official |
| --- | --- |
| Cloudflare Code Mode | [cloudflare/mcp](https://github.com/cloudflare/mcp) · `https://mcp.cloudflare.com/mcp` · docs on [developers.cloudflare.com](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/) |
| Cloudflare product MCPs | Hosted `https://*.mcp.cloudflare.com/mcp` listed on that same page (docs, bindings, observability, …) |
| Supabase | [supabase/mcp](https://github.com/supabase/mcp) · `https://mcp.supabase.com/mcp` · [docs](https://supabase.com/docs/guides/ai-tools/mcp) |

Do not ship (examples fetched **200**; still unofficial / unmaintained):

| Wrapper | Why |
| --- | --- |
| [mattzcarey/cloudflare-mcp](https://github.com/mattzcarey/cloudflare-mcp) | Community Code Mode clone. Not `cloudflare/mcp`. |
| Other `*-cloudflare-mcp` / `mcp-cloudflare*` npm images not under `cloudflare/*` | Community API wrappers. Token leaves the official host. |
| [alexander-zuev/supabase-mcp-server](https://github.com/alexander-zuev/supabase-mcp-server) | Community “Query MCP”. README: **no longer maintained** after official Supabase MCP. |
| Authless `*.workers.dev/sse` Supabase/CF templates | Not the vendor tray. |

`cloudflare/mcp-server-cloudflare` (200) is Cloudflare's **product-specific** hosted servers repo — not a community wrapper. Use the URLs on the official docs page; do not invent extra CF hosts from blogs.

`supabase-community/supabase-mcp` (200) redirects at the official `supabase/mcp` tree — that is the official server, not a wrapper.

---

## Legacy `/sse` (410 / gone)

MCP HTTP+SSE (`2024-11-05`) is deprecated. New rows use Streamable HTTP `/mcp`.

Fetched 2026-09-18 (bare GET, no OAuth):

| URL | HTTP | Ship |
| --- | --- | --- |
| `https://docs.mcp.cloudflare.com/sse` | **410** | `https://docs.mcp.cloudflare.com/mcp` |
| `https://bindings.mcp.cloudflare.com/sse` | **410** | `https://bindings.mcp.cloudflare.com/mcp` |
| `https://mcp.sentry.dev/sse` | **410** | `https://mcp.sentry.dev/mcp` |
| `https://mcp.linear.app/sse` | **404** | `https://mcp.linear.app/mcp` |
| `https://mcp.cloudflare.com/sse` | **404** | `https://mcp.cloudflare.com/mcp` |
| `https://mcp.vercel.com/sse` | **404** | `https://mcp.vercel.com` |
| `https://mcp.supabase.com/sse` | **404** | `https://mcp.supabase.com/mcp` |
| `https://mcp.slack.com/sse` | **404** | `https://mcp.slack.com/mcp` |
| `https://mcp.notion.com/sse` | **401** | `https://mcp.notion.com/mcp` — Notion still answers `/sse` with auth, but catalog must not add new `/sse` rows. Linear docs call `/sse` a deprecated fallback. |

Cloudflare product docs: historical `/sse` URLs may alias the Streamable HTTP handler; a legacy SSE **GET** is **410 Gone**. Do not configure clients with `transport: sse`.

**No 404s in [`CATALOG.md`](CATALOG.md).** If an official page drops an endpoint, mark the cell `UNVERIFIED` or move it here — do not keep a dead URL in the tray table.
