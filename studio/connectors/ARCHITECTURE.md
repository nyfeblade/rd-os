# Studio connectors — Integration Blueprint

**Product lock.** Split **ingress** vs **egress**. Hard cutover is already law (`studio/seats/CUTOVER.md`). This file is catalog/architecture SoT. It does **not** implement a webhook gateway.

`verdict` stays null. `clock_started` stays false. Docs here are not a claim that Studio is wired beyond the P0 GitHub + Slack runtime.

| Path | Role |
| --- | --- |
| this file | Ingress vs egress, ingest schema sketch, HITL, wire order, token-efficiency law |
| [`CATALOG.md`](CATALOG.md) | Tray SoT — official URLs only |
| [`DO-NOT-SHIP.md`](DO-NOT-SHIP.md) | Archived / community / legacy `/sse` denylist |
| [`runtime/`](runtime/) | P0 GitHub + Slack two-way contracts (leave alone unless a later PR extends providers) |

Next fence (not this PR): `studio/connectors/ingress/**` — webhook gateway.

---

## Token efficiency (PRODUCT LAW)

Connectors are expensive context. Studio spends tokens like an engineer, not a chat room. This is a note on this blueprint — **no new fence**.

| Law | Means |
| --- | --- |
| **brief-once** | One ingest envelope, one inbox item, one bound thread. Do not re-brief the same webhook into Chat and Board and the seat. |
| **quiet-when-green** | No tray noise, no CA ping, no Slack/GitHub echo when `need_you` is false. Green CI, idle catalog, successful deploys stay hidden ([VISIBILITY](../design/VISIBILITY.md)). |
| **no duplicate CA same files** | One Cloud Agent (or Claude/Grok seat) owns a fence. Do not launch a second CA on the same paths. Mode rails already reject `LANE_COLLISION` / `FENCE_OVERLAP`. |
| **Proof ≠ self-cert** | A green MCP/REST call is not a verdict. `verdict` stays null; `clock_started` stays false. Proof is a Board gate / measured harness (`studio/modes` `no-self-cert`). |
| **CA / Claude muscle, thin orchestration** | Prefer the seat's own tools (Cloud Agent, Claude Code, official MCP). Studio orchestrates: ingest → inbox → bound reply / HITL. Do not wrap every vendor in a second agent loop. |
| **HITL + cutover kill cross-app chatter** | Bots do not fan out GitHub ↔ Slack ↔ Linear ↔ Sentry. Hard cutover = in-studio-only. Merge / deploy / DB / public post still HITL. No connector-to-connector relay. |

---

## Split

```
INGRESS                          EGRESS
vendor webhook ──► gateway ──►   MCP tool call
                   Studio        OR REST / GraphQL reply
                   Ingest ──►    HITL on sensitive writes
                   Schema ──►    (merge / deploy / DB / public post)
                   desktop inbox
```

| Direction | Surface | What |
| --- | --- | --- |
| **Ingress** | Webhook gateway → Studio Ingest Schema → desktop inbox | GitHub / Slack / Linear / Sentry / Vercel / … events. MCP is **not** the webhook path. |
| **Egress** | MCP tool call **or** REST/GraphQL | Human reply from the bound Chat composer. Bot send requires **in-studio-only cutover + HITL**. |

P0 two-way already law: [`studio/design/CONNECTORS-TWO-WAY.md`](../design/CONNECTORS-TWO-WAY.md). Inbox prefers Chat; Board card if `needs_gate`. Composer is `bound_to` the active notification.

---

## Ingress

**Not built here.** The gateway lives in the next fence (`studio/connectors/ingress/**`). Catalog + this sketch are the contract it must emit.

1. Vendor webhook (signed) lands on the gateway.
2. Gateway verifies signature, maps the vendor event, **sanitizes** the payload (webhook body is untrusted — see [Security](#security)).
3. Gateway emits one **Studio Ingest Schema** envelope.
4. Desktop inbox consumes the envelope the same way `runtime.ingest` already does for GitHub + Slack.

### Studio Ingest Schema (sketch)

Closed enough to implement against. Do not invent fields in the shell.

```js
{
  provider: "github" | "slack" | "linear" | "sentry" | "vercel" | "cloudflare" | "supabase" | string,
  event: string,                 // vendor event name (closed per provider)
  received_at: string,           // ISO-8601
  at_you: boolean,               // mention / assignee / CI@you
  tray_state: "live" | "needs_auth" | "error" | "disconnected",
  identity: {
    actor_kind: "user" | "bot" | "app",
    actor_id: string,
    as_user: boolean             // user token vs bot/app token
  },
  payload: object                // sanitized vendor body — never raw-to-LLM
}
```

Maps to the desktop inbox item (already closed in `runtime/contract.js` for P0):

```js
{
  id, provider, kind, need_you, needs_gate,
  dest: "chat" | "board" | "chat+board",
  thread_ref, title, body, actor, created_at, tray_state
}
```

`needs_gate` is true iff `dest` is `board` or `chat+board`. Noise drops (`dropped: true`) never become inbox items.

P0 in (already wired in `runtime/`, not this PR):

| Provider | Vendor events | Inbox |
| --- | --- | --- |
| GitHub | PR/issue comments, reviews, review requests, CI@you | Chat; Board if gate |
| Slack | Eng channel `app_mention` + DM `@mentions` | Chat |

P1+ providers reuse this envelope. They do not grow a second inbox shape.

---

## Egress

Two legal send paths — pick the vendor's official one from [`CATALOG.md`](CATALOG.md). Do not invent hosts.

1. **MCP tool call** — hosted Streamable HTTP (`/mcp`) or local stdio the catalog names.
2. **REST / GraphQL reply** — closed op name + official docs URL (P0 today: GitHub issue/review comments; Slack `chat.postMessage`).

HITL gate on **sensitive writes** (bot or seat tool — no silent side effects):

| Class | Examples | Gate |
| --- | --- | --- |
| Merge | GitHub merge, GitLab MR merge | Board Approve |
| Deploy | Vercel promote, Cloudflare Worker/DNS/cache write | Board Approve |
| DB | Supabase SQL / migration / branch merge | Board Approve |
| Public post | Slack channel post, GitHub comment from a **bot** | cutover attached **and** `human_gate.status===approved` |

Human replies from the bound composer: no cutover, no gate. Bot send: both hooks (`BOT_SEND_NO_CUTOVER` / `BOT_SEND_NO_GATE`). Hard cutover: bots speak only in-studio.

---

## Wire order (after GitHub + Slack)

P0 runtime is GitHub + Slack. Next ingress+egress wires, in this order — do not jump the queue:

| # | Connector | Ingress (webhook) | Egress |
| --- | --- | --- | --- |
| 1 | **Linear** | Linear webhooks | Official MCP `https://mcp.linear.app/mcp` |
| 2 | **Sentry** | Sentry issue webhooks | Official MCP `https://mcp.sentry.dev/mcp` |
| 3 | **Vercel** | Vercel deploy/log webhooks | Official MCP `https://mcp.vercel.com` |
| 4 | **Cloudflare Code Mode** | Cloudflare notifications / Logpush (when a later ingress PR names the event) | Official Code Mode MCP `https://mcp.cloudflare.com/mcp` |
| 5 | **Supabase** | Database / auth webhooks (when named) | Official MCP `https://mcp.supabase.com/mcp` |

Catalog tier (P0/P1/P2) is unchanged. Wire order is not a priority rewrite.

---

## Security

Full tray notes: [`CATALOG.md` Security](CATALOG.md#security). Non-negotiables:

- **User vs bot identity** — never conflate. Slack MCP tools are user-token; in-Slack bots are bot-token. GitHub user OAuth/PAT ≠ GitHub App.
- **CIMD / allowlist** — accept Client ID Metadata Document hosts only from an allowlist. Slack official MCP: confidential OAuth, **no DCR**.
- **Sanitize webhook → LLM** — issue bodies, Slack text, Sentry breadcrumbs are attacker-controlled. Strip instruction-like content before a seat sees `payload`.
- **HITL** — merge / deploy / DB / public post. See table above.

---

## Slack conflict (resolved)

Blueprint rumor: “Slack official MCP archived → API/Bolt only.”

**Live Slack docs contradict that.** Fetched 2026-09-18:

- [docs.slack.dev/ai/slack-mcp-server](https://docs.slack.dev/ai/slack-mcp-server) → **200**. Documents Streamable HTTP at `https://mcp.slack.com/mcp`.
- `GET https://mcp.slack.com/mcp` → **401** (OAuth required — expected; not gone).
- `GET https://mcp.slack.com/.well-known/oauth-protected-resource` → **200**.

What **is** archived: `@modelcontextprotocol/server-slack` in [servers-archived](https://github.com/modelcontextprotocol/servers-archived/tree/main/src/slack). That is a reference stdio binary, not Slack's hosted server.

**Correct split:** ingress = [Events API](https://docs.slack.dev/apis/events-api/) / [Bolt](https://docs.slack.dev/tools/bolt-js). Egress = official Slack MCP **or** `chat.postMessage`. Catalog row stays MCP. Denylist the archived package in [`DO-NOT-SHIP.md`](DO-NOT-SHIP.md).

---

## Out of this fence

- Do not implement `studio/connectors/ingress/**`.
- Do not edit `runtime/**` unless a one-line pointer is required (prefer leave it).
- Do not invent MCP hosts. Missing official URL = `UNVERIFIED` in the catalog, never a guessed `mcp.*`.
