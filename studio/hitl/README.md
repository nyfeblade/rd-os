# studio/hitl

Board HITL / need-you kernel for AI Coding Studio. This package owns gate objects. A human must approve, reject, or defer. Merge, deploy, DB, and public post never auto-approve.

**Fence:** `studio/hitl/` only. Shell, seats, chat-engine, and connectors stay in other lanes.

## Stranger

Cold clone. No install. Node >= 18.

```bash
cd studio/hitl
npm test
```

Expect exit 0:

```
PASS studio/hitl gates (measured; cases=N passed=N failed=0; wall_ms=…)
```

`clock_started` stays false. `verdict` stays null.

## Call

```js
const { createHitlKernel } = require("@rd-os/studio-hitl");

const hitl = createHitlKernel();
const created = hitl.createGate({
  kind: "merge",
  title: "Merge PR 12",
  payload_summary: "merge #12 into main",
  chat_thread_id: "thread_9",
  board_card_id: "card_4",
});
// created.data.gate.need_you === true
// created.data.gate.status === "open"
// created.data.gate.risk === "high"

hitl.listNeedYou();
// { ok: true, data: { gates: [created.data.gate] } }

hitl.resolveGate({ id: created.data.gate.id, decision: "approve", actor: "human" });
// status approved, need_you false
```

`chat_thread_id` and `board_card_id` are bind notes. This kernel stores them. Chat and Board own the ids.

## Gate

| Field | Rule |
| --- | --- |
| `id` | Kernel-assigned |
| `kind` | `merge` \| `deploy` \| `db` \| `public_post` |
| `title` | Required |
| `need_you` | Derived. True only while `status` is `open` |
| `risk` | Derived from `kind`. These four kinds are `high` |
| `payload_summary` | Preview text for the Board card |
| `status` | `open` \| `approved` \| `rejected` \| `deferred` |
| `created_at` | ISO-8601 |

`createGate` always opens. It rejects `status: "approved"` and `auto_approve: true`.

`resolveGate` accepts `approve`, `reject`, or `defer`. High-risk kinds require `actor: "human"`. Actors `merge`, `deploy`, `db`, `public`, `system`, `auto`, and `bot` return `HUMAN_REQUIRED`.

## Import later

```ts
import type { Gate, GateBindNotes, HitlKernel } from "../hitl/types";
```
