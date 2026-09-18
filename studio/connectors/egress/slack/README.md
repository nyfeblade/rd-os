# studio/connectors/egress/slack

Contract → HTTP harness for Slack [`chat.postMessage`](https://docs.slack.dev/reference/methods/chat.postMessage). Studio can later DM from the app path. This lane maps the runtime closed op `post_message` (and a runtime-style reply draft) onto the official Web API. It does not rewrite `runtime/**`, `ingress/**`, the catalog, or shell chrome.

```js
const { map, send, dm } = require("./studio/connectors/egress/slack");
```

```bash
node studio/connectors/egress/slack/prove.js
# exit 0 — mapping + missing-env reject. No HTTP.

node studio/connectors/egress/slack/prove.js --gate studio/connectors/egress/slack/fixtures/good
# exit 0

node studio/connectors/egress/slack/prove.js --gate studio/connectors/egress/slack/fixtures/planted
# exit 2
```

Node 18+. No npm install. Default is **DRY**. `verdict` stays null. `clock_started` stays false.

`--live` is documented below and is **not** a CI step.

## What it accepts

Runtime consume-only. Either shape:

1. **Closed outbound** from `runtime.reply` — `op: "post_message"`, `request: { channel, text, thread_ts? }`.
2. **Reply draft** — `provider: "slack"`, `body`, `thread_ref: { channel, thread_ts? }`.

Maps to official `POST https://slack.com/api/chat.postMessage` args only: `channel`, `text`, optional `thread_ts`, optional `reply_broadcast`. Token is the `Authorization: Bearer` header ([docs](https://docs.slack.dev/reference/methods/chat.postMessage)). Bot token posts as the app (`as_user` is legacy; this harness does not set it).

DM helper (optional): [`conversations.open`](https://docs.slack.dev/reference/methods/conversations.open) with `users`, then `chat.postMessage` to the returned IM id.

## Modes

| Call | HTTP? |
| --- | --- |
| `map(input)` | Never. |
| `send(input)` / `send(input, { live: false })` | Never. Returns the mapped request with `dry: true`. |
| `send(input, { live: true })` | Only if `SLACK_BOT_TOKEN` is set. Else `{ ok: false, code: "NEEDS_AUTH" }`. |
| `dm(input)` dry | Never. Needs a user id (`input.user` or `SLACK_DM_USER_ID`). |
| `dm(input, { live: true })` | Only with `SLACK_BOT_TOKEN`. Live prove (below) also requires `SLACK_DM_USER_ID`. |

Tokens are never invented. Slack is never called when the token env is missing. A token sitting in the environment does **not** send — `live: true` (or `--live`) is required.

## Tokens (Luke secret-request)

This tree never stores Slack tokens. Do not invent `xoxb-` values. Do not commit `.env`. Do not paste tokens into fixtures, PRs, or chat logs.

Luke secret-requests these names into the Cloud Agent run (Cursor environment secrets) or exports them in his own shell:

| Env | Required for | What |
| --- | --- | --- |
| `SLACK_BOT_TOKEN` | live HTTP | Bot User OAuth Token. Scope `chat:write`. DM helper also needs `im:write`. |
| `SLACK_DM_USER_ID` | live `--live` DM | Slack member id (`U…`) passed as `users` to `conversations.open`. |

Mint on a Slack app (official site, not this repo): create/install the app, grant those bot scopes, copy the bot token and the target member id, then secret-request the two names. Default `prove.js` does not need them.

## No live-send from this lane

Do **not** live-send until:

1. the Studio shell consumes this module from the app path, or
2. Lead approves the CLI below.

```bash
# Lead-approved only. Both env vars required. Not CI.
SLACK_BOT_TOKEN=… SLACK_DM_USER_ID=U… node studio/connectors/egress/slack/prove.js --live
```

Without both vars, `--live` prints `{ ok: false, code: "NEEDS_AUTH" }` and exits 2. It does not invent a token and does not call Slack.

## Out of this fence

- `studio/connectors/ingress/**`
- `studio/connectors/runtime/**` (shape consume only)
- `studio/connectors/CATALOG.md`, `ARCHITECTURE.md`, `DO-NOT-SHIP.md`
- `studio/shell`, seats, github, design consumers
