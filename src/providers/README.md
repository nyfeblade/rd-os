# llm.complete — thin provider adapter

Env-keyed completion. Not the kernel. Not an MCP tool. Not a 14-day PASS.

**Shipped provider: OpenAI** (`LLM_PROVIDER=openai`, default). Chat Completions only. Anthropic and Grok are not shipped in this lane.

ResourceExhausted ⇒ `{ ok: false, code: "RESOURCE_EXHAUSTED", stop: true }`. **STOP. No retry.**

---

## Env keys (OpenAI)

| Variable | Required | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes, for a live call | — |
| `LLM_PROVIDER` | no | `openai` |
| `OPENAI_BASE_URL` | no | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | no | `gpt-4o-mini` |

Any other `LLM_PROVIDER` returns `UNKNOWN_PROVIDER`. Do not add a second adapter in this PR.

---

## Call

```js
const { complete } = require("./src/providers");

const result = await complete({
  prompt: "Reply with the single word pong.",
  system: "You are a terse probe.",
  max_tokens: 16,
});
```

OK:

```json
{
  "ok": true,
  "data": {
    "text": "pong",
    "model": "gpt-4o-mini",
    "provider": "openai",
    "usage": { "prompt_tokens": 12, "completion_tokens": 1, "total_tokens": 13 },
    "wall_ms": 84,
    "stop": false
  }
}
```

Reject: `{ ok: false, code, detail, wall_ms, stop }`.

| code | when |
| --- | --- |
| `MISSING_KEY` | `OPENAI_API_KEY` empty |
| `MISSING_PROMPT` | `prompt` missing/blank |
| `UNKNOWN_PROVIDER` | `LLM_PROVIDER` is not `openai` |
| `RESOURCE_EXHAUSTED` | HTTP 429 / insufficient_quota / ResourceExhausted — **do not retry** |
| `PROVIDER_ERROR` | other non-OK provider response |
| `NETWORK_ERROR` | fetch threw |

---

## Cursor / consumer

Use this adapter **beside** existing MCP attach (`consumers/cursor-mcp`). Recipe + measured smoke: `consumers/llm-complete`.

```bash
cd consumers/llm-complete
npm test
```
