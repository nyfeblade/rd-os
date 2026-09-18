# studio/connectors/runtime

P0 two-way contracts for **GitHub** and **Slack**, aligned to the product lock (CONNECTORS-TWO-WAY): connectors are bidirectional. Notifications in; human replies out; bots send only with **cutover + human gate**.

```bash
node studio/connectors/runtime/prove.js                                      # exit 0
node studio/connectors/runtime/prove.js --gate studio/connectors/runtime/fixtures/good
node studio/connectors/runtime/prove.js --gate studio/connectors/runtime/fixtures/planted  # exit 2
```

Node 18+. No npm install. No HTTP. No invented REST or MCP paths. `verdict` stays null. `clock_started` stays false.

Tray is not read-only: auth, live state, inbox entry, send path. This module reports `tray_state` and the send contract. Shell / seats / github UI / design are consume-only — do not edit them from this lane.

## Consumer contract

### Inbox (Chat preferred; Board if it needs a gate)

`ingest(envelope)` → `{ ok, dropped, item, code, verdict: null, clock_started: false }`.

Envelope:

```js
{ provider: "github"|"slack", event, payload, tray_state: "live"|"needs_auth"|"error"|"disconnected", at_you?, received_at? }
```

Inbox item fields (closed): `id` · `provider` · `kind` · `need_you` · `needs_gate` · `dest` (`chat`|`board`|`chat+board`) · `thread_ref` · `title` · `body` · `actor` · `created_at` · `tray_state`.

`needs_gate` is true iff `dest` is `board` or `chat+board` (Board card). Chat thread is preferred for comments and @mentions.

| P0 in | Maps to |
| --- | --- |
| GitHub PR/issue comments, reviews | `kind=comment\|review\|review_comment`, `dest=chat` |
| GitHub review requests | `kind=review_request`, `dest=chat+board` (gate) |
| GitHub CI@you | `check_suite` / `workflow_run` failure **and** `at_you===true` → `kind=ci_failure`, `dest=board`. Other CI drops. |
| Slack eng channel / DM @mentions | `app_mention` → `mention`; IM text with `<@…>` → `dm`. Channel chatter and un-@'d IMs drop. |

| Visibility | What |
| --- | --- |
| Show | `need_you === true` and `kind=auth_failure` |
| Hide | `dropped: true` noise; disconnected tray; idle catalog |

`tray_state=needs_auth` becomes an `auth_failure` item (`dest=chat+board`, `needs_gate=true`). `disconnected` drops. `error` still maps a live event so the tray can show both the ping and the error.

### Reply composer (bound to the active notification)

`reply(draft)` → `{ ok, outbound, code, verdict: null, clock_started: false }`.

The composer is the same Chat composer, **bound to the active notification/thread** — not a free-floating global outbox.

```js
{
  provider, actor: "human"|"bot", kind, thread_ref, bound_to, body, tray_state,
  cutover?: { status: "attached"|"unattached", in_studio_only: boolean },
  human_gate?: { status: "approved"|"pending"|"rejected", by? }
}
```

- `bound_to` is the inbox item id. Missing → `UNBOUND_REPLY`.
- Human: no cutover, no gate.
- Bot: **both** hooks. `cutoverAllows` requires `cutover.status==="attached"` and `in_studio_only===true` (`BOT_SEND_NO_CUTOVER`). `humanGateAllows` requires `human_gate.status==="approved"` (`BOT_SEND_NO_GATE`).
- Reply requires `tray_state=live` (`NEEDS_AUTH` otherwise) and a non-empty `body`.

Outbound is a **closed op name** plus request fields — not a guessed URL:

| Provider | Reply kind | Op | Official docs |
| --- | --- | --- | --- |
| GitHub | `issue_comment` | `create_issue_comment` | [REST issue comments](https://docs.github.com/en/rest/issues/comments) |
| GitHub | `pull_request_review_comment` | `create_pull_request_review_comment` | same family |
| GitHub | `pull_request_review` | `create_pull_request_review` | same family |
| Slack | `message` | `post_message` | [chat.postMessage](https://docs.slack.dev/reference/methods/chat.postMessage) |

Ingest event names come from [GitHub webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads) and the [Slack Events API](https://docs.slack.dev/apis/events-api/).

## Codes (closed)

`BOT_SEND_NO_GATE` · `BOT_SEND_NO_CUTOVER` · `UNBOUND_REPLY` · `EMPTY_BODY` · `UNKNOWN_PROVIDER` · `UNKNOWN_EVENT` · `NEEDS_AUTH` · `INVALID_EVENT`

## Files

| Path | What |
| --- | --- |
| `index.js` | `ingest` / `reply` / `humanGateAllows` / `cutoverAllows` |
| `contract.js` | Closed sets |
| `inbox.js` | Inbox item builder |
| `reply.js` | Cutover + human-gate hooks + outbound shape |
| `providers/github.js` | GitHub webhook → inbox; comment/review out |
| `providers/slack.js` | Slack Events API → inbox; `post_message` out |
| `fixtures/good/` | Accepted ingest/reply (including noise drops) |
| `fixtures/planted/` | One record per reject code |
| `prove.js` | Expectation suite and `--gate` |

P1+ catalog tools are not wired here. Same two-way pattern when a later PR enables them.
