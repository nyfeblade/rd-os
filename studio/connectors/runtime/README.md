# studio/connectors/runtime

P0 two-way contracts for **GitHub** and **Slack**: ingest vendor events into a Studio inbox item, and send a human or bot reply back through the same connector.

```bash
node studio/connectors/runtime/prove.js                                      # exit 0
node studio/connectors/runtime/prove.js --gate studio/connectors/runtime/fixtures/good
node studio/connectors/runtime/prove.js --gate studio/connectors/runtime/fixtures/planted  # exit 2
```

Node 18+. No npm install. No HTTP. No invented REST or MCP paths. `verdict` stays null. `clock_started` stays false.

Product lock: notifications in, replies out. Inbox lands in Chat and/or Board (`dest`). Reply composer is the same Chat composer. Tray owns auth + inbox filters; this module only reports `tray_state`. Shell / seats / github UI / design are consume-only — do not edit them from this lane.

## Consumer contract

### Inbox (Chat / Board read)

`ingest(envelope)` → `{ ok, dropped, item, code, verdict: null, clock_started: false }`.

Envelope:

```js
{ provider: "github"|"slack", event, payload, tray_state: "live"|"needs_auth"|"error"|"idle", received_at? }
```

Inbox item fields (closed): `id` · `provider` · `kind` · `need_you` · `dest` (`chat`|`board`|`chat+board`) · `thread_ref` · `title` · `body` · `actor` · `created_at` · `tray_state`.

| Visibility | What |
| --- | --- |
| Show | `need_you === true` (PR/issue comments, review requests, Slack mention/DM, CI failure) and `kind=auth_failure` |
| Hide | `dropped: true` noise (successful CI, non-IM Slack messages, deleted comments) |

`tray_state=needs_auth` becomes an `auth_failure` item (`dest=chat+board`, `need_you=true`). `idle` drops. `error` still maps a live event so the tray can show both the ping and the error.

### Reply composer (Chat / Board write)

`reply(draft)` → `{ ok, outbound, code, verdict: null, clock_started: false }`.

```js
{
  provider, actor: "human"|"bot", kind, thread_ref, body, tray_state,
  human_gate?: { status: "approved"|"pending"|"rejected", by? }
}
```

- Human: no gate.
- Bot: `humanGateAllows(draft)` is the hook. `BOT_SEND_NO_GATE` unless `human_gate.status === "approved"`.
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

`BOT_SEND_NO_GATE` · `EMPTY_BODY` · `UNKNOWN_PROVIDER` · `UNKNOWN_EVENT` · `NEEDS_AUTH` · `INVALID_EVENT`

## Files

| Path | What |
| --- | --- |
| `index.js` | `ingest` / `reply` / `humanGateAllows` |
| `contract.js` | Closed sets |
| `inbox.js` | Inbox item builder |
| `reply.js` | Human-gate hook + outbound shape |
| `providers/github.js` | GitHub webhook → inbox; comment/review out |
| `providers/slack.js` | Slack Events API → inbox; `post_message` out |
| `fixtures/good/` | Accepted ingest/reply (including noise drops) |
| `fixtures/planted/` | One record per reject code |
| `prove.js` | Expectation suite and `--gate` |

P1+ catalog tools are not wired here. Same two-way pattern when a later PR enables them.
