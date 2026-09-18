# GitHub notifications to Studio ingest

Reference for `lib/notifications.js`. This package maps GitHub notification objects to the Studio ingest envelope in `studio/connectors/ARCHITECTURE.md`. It does not import `studio/connectors/**` and does not run a webhook gateway.

`verdict` stays null. `clock_started` stays false.

## Envelope fields

The mapper returns this object when `ok` is true.

| Field | Type | Source |
| --- | --- | --- |
| `provider` | `"github"` | fixed |
| `event` | string | `SUBJECT_TO_EVENT[subject.type]` |
| `received_at` | ISO-8601 string | `notification.updated_at` |
| `at_you` | boolean | `reason` is in `AT_YOU_REASONS` |
| `tray_state` | `live` \| `needs_auth` \| `error` \| `disconnected` | `opts.tray_state`, else `live` when `opts.has_token`, else `needs_auth` |
| `identity.actor_kind` | `user` \| `bot` \| `app` | `opts.actor_kind`, default `user` |
| `identity.actor_id` | string | `opts.actor_id`, default `""` |
| `identity.as_user` | boolean | `opts.as_user !== false` |
| `payload` | object | sanitized subset below |

`payload` keeps `id`, `reason`, `unread`, `subject.{title,type,url,latest_comment_url}`, and `repository.full_name`. It drops the rest of the vendor body.

Identity is not on a GitHub notification. Callers pass `actor_id` when they know the authenticated login. User PATs set `as_user` true.

## Subject type to event

GitHub notifications use `subject.type`. Connectors P0 GitHub ingest uses webhook event names. This table is the documented join.

| `subject.type` | `envelope.event` |
| --- | --- |
| `Issue` | `issue_comment` |
| `PullRequest` | `pull_request` |
| `PullRequestReview` | `pull_request_review` |
| `PullRequestReviewComment` | `pull_request_review_comment` |
| `CheckSuite` | `check_suite` |
| `CheckRun` | `check_suite` |
| `WorkflowRun` | `workflow_run` |

Any other `subject.type` is `UNKNOWN_EVENT`. The mapper does not invent webhook names.

## Reason to `at_you`

| `reason` | `at_you` |
| --- | --- |
| `mention` | true |
| `assign` | true |
| `review_requested` | true |
| `author` | true |
| `team_mention` | true |
| `security_alert` | true |
| `invitation` | true |
| `ci_activity` | true |
| `subscribed` | false |
| `comment` | false |
| `manual` | false |
| `state_change` | false |

`ci_activity` is true because the notifications list is already the authenticated user's inbox. Quiet-when-green still belongs to connectors ingest, not this mapper.

## Inbox item (not built here)

ARCHITECTURE maps a valid envelope onto a desktop inbox item (`id`, `provider`, `kind`, `need_you`, `needs_gate`, `dest`, `thread_ref`, `title`, `body`, `actor`, `created_at`, `tray_state`). This package stops at the envelope. Shell and connectors runtime own the inbox.

## Call

```js
const { mapNotification } = require("./lib/notifications");
const result = mapNotification(notification, { has_token: true, actor_id: "nyfeblade" });
```
