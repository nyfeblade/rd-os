# studio/connectors/egress/slack

Contract → HTTP harness for Slack [`chat.postMessage`](https://docs.slack.dev/reference/methods/chat.postMessage). Studio can later DM from the app path. Until [`studio/shell` Chat (PR#11)](https://github.com/nyfeblade/rd-os/pull/11) is on main, the **Lead-approved consumer is this package's CLI/gate**.

Runtime outbound shape is consume-only. This lane does not rewrite `runtime/**`, `ingress/**`, the catalog, or shell chrome.

```js
const { map, send, dm } = require("./studio/connectors/egress/slack");
```

```bash
node studio/connectors/egress/slack/prove.js
# exit 0 — mapping + missing-env reject + CLI dry-run. No HTTP.

node studio/connectors/egress/slack/cli.js --dry
# measured Chat stand-in. Prints mapped chat.postMessage JSON. Never HTTP.

node studio/connectors/egress/slack/cli.js --dry --in studio/connectors/egress/slack/fixtures/good/outbound-post-message.json

node studio/connectors/egress/slack/cli.js --prove

node studio/connectors/egress/slack/cli.js --gate studio/connectors/egress/slack/fixtures/good
# exit 0

node studio/connectors/egress/slack/cli.js --gate studio/connectors/egress/slack/fixtures/planted
# exit 2
```

Node 18+. No npm install. Default is **DRY**. Secrets never live in this tree. `verdict` stays null. `clock_started` stays false.

`--live` is optional, env-gated, and **not** a CI step.

## What it accepts

Runtime consume-only. Either shape:

1. **Closed outbound** from `runtime.reply` — `op: "post_message"`, `request: { channel, text, thread_ts? }`.
2. **Reply draft** — `provider: "slack"`, `body`, `thread_ref: { channel, thread_ts? }`.

Maps to official `POST https://slack.com/api/chat.postMessage` args only: `channel`, `text`, optional `thread_ts`, optional `reply_broadcast`. Token is the `Authorization: Bearer` header ([docs](https://docs.slack.dev/reference/methods/chat.postMessage)). Bot token posts as the app (`as_user` is legacy; this harness does not set it).

DM helper (optional): [`conversations.open`](https://docs.slack.dev/reference/methods/conversations.open) with `users`, then `chat.postMessage` to the returned IM id.

## Modes

| Call | HTTP? |
| --- | --- |
| `map(input)` / `cli.js --dry` | Never. |
| `send(input)` / `send(input, { live: false })` | Never. Returns the mapped request with `dry: true`. |
| `send(input, { live: true })` | Only if `SLACK_BOT_TOKEN` is set. Else `{ ok: false, code: "NEEDS_AUTH" }`. |
| `dm(input)` dry / `cli.js --dry --dm` | Never. Needs a user id (`input.user` or `SLACK_DM_USER_ID`). |
| `dm(input, { live: true })` / `cli.js --live --dm` | Only with `SLACK_BOT_TOKEN` + `SLACK_DM_USER_ID`. |

Tokens are never invented. Slack is never called when the token env is missing. A token sitting in the environment does **not** send — `live: true` (or `--live`) is required. CLI `--dry` passes an empty env into `send`/`dm` so process secrets cannot leak into a dry run.

`publicReport` prints `auth_present: { SLACK_BOT_TOKEN, SLACK_DM_USER_ID }` as booleans only. It never prints token values.

## Tokens (Luke secret-request)

This tree never stores Slack tokens. Do not invent `xoxb-` values. Do not commit `.env`. Do not paste tokens into fixtures, PRs, or chat logs.

Luke secret-requests these names into the Cloud Agent run (Cursor environment secrets) or exports them in his own shell:

| Env | Required for | What |
| --- | --- | --- |
| `SLACK_BOT_TOKEN` | live HTTP | Bot User OAuth Token. Scope `chat:write`. DM helper also needs `im:write`. |
| `SLACK_DM_USER_ID` | live `--live --dm` | Slack member id (`U…`) passed as `users` to `conversations.open`. |

Mint on a Slack app (official site, not this repo): create/install the app, grant those bot scopes, copy the bot token and the target member id, then secret-request the two names. Default `prove.js` and `cli.js --dry` do not need them.

## Live CLI (optional, not CI)

Lead approved this CLI as the send path until Chat lands. Live still requires env on the process — never a file in the repo.

```bash
# optional. Both env vars required. Not CI.
SLACK_BOT_TOKEN=… SLACK_DM_USER_ID=U… node studio/connectors/egress/slack/cli.js --live --dm

# or a closed outbound JSON (no secrets in the file)
SLACK_BOT_TOKEN=… node studio/connectors/egress/slack/cli.js --live --in outbound.json
```

Without the required vars, `--live` prints `{ ok: false, code: "NEEDS_AUTH" }` and exits 2. It does not invent a token and does not call Slack.

## Out of this fence

- `studio/connectors/ingress/**`
- `studio/connectors/runtime/**` (shape consume only)
- `studio/connectors/CATALOG.md`, `ARCHITECTURE.md`, `DO-NOT-SHIP.md`
- `studio/shell`, seats, github, design consumers (Chat consume comes after PR#11 merges)
