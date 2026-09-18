# Cursor attach — llm.complete (beside MCP)

Third consumer after `consumers/eng-proof` and `consumers/cursor-mcp`. This directory is the **Cursor attach recipe** for the thin `llm.complete` adapter in `../../src/providers`. It does **not** replace MCP attach.

Not the kernel. Not a second Waiting UI. Not a 14-day PASS. `verdict` stays null. `clock_started` stays false. ResourceExhausted ⇒ STOP, no retry.

**Shipped provider: OpenAI** via `OPENAI_API_KEY`. Default model `gpt-4o-mini`. Anthropic and Grok are not shipped.

---

## Two attach surfaces (keep both)

| Surface | Path | Role |
| --- | --- | --- |
| rd-os MCP tools | `consumers/cursor-mcp/.cursor/mcp.json` | `experiment.*`, `claim.*`, `attention.dump`, … |
| `llm.complete` | this directory (`bin/complete.js`) | outbound Chat Completions only |

Do **not** add `llm.complete` as an MCP tool (CA2 owns the contract). Do **not** wrap Cursor / Claude / Grok. Agents stay the host; they call this adapter from a shell/node step when they need a completion.

Committed recipe: `.cursor/recipe.json`.

```json
{
  "name": "rd-os-llm-complete",
  "beside": "../cursor-mcp",
  "provider": "openai",
  "adapter": "../../src/providers",
  "cli": "node ./bin/complete.js --in payloads/hello.json",
  "env": {
    "LLM_PROVIDER": "openai",
    "OPENAI_API_KEY": "<set locally; never commit>"
  },
  "mcp": {
    "note": "Keep existing rd-os MCP attach. Do not add llm.complete as an MCP tool.",
    "see": "../cursor-mcp/.cursor/mcp.json"
  }
}
```

Print the same recipe:

```bash
npm run attach
```

---

## Cold stranger path (clone → this directory → one command)

Requires Node 18+. No UI. No `kill14d` clock. **No live OpenAI call** unless you set `LLM_COMPLETE_LIVE=1`.

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os/consumers/llm-complete
npm test
echo "exit=$?"
```

Expected: **exit 0**. `npm test` loads `../../src/providers`, checks the Cursor recipe sits beside `consumers/cursor-mcp`, and measures mocked `llm.complete` including a 429 that must **not** retry.

```
PASS recipe names openai adapter beside cursor-mcp MCP
PASS existing cursor-mcp attach still present (not replaced)
PASS MISSING_KEY
PASS RESOURCE_EXHAUSTED 429 fetch_calls=1 (no retry)
PASS llm-complete (OpenAI llm.complete + Cursor recipe beside MCP; wall_ms=…; not a 14d verdict)
```

---

## Live complete (optional)

Only when you have a key **and** you opt in. Quota / 429 ⇒ STOP, exit 3, no second attempt.

```bash
OPENAI_API_KEY=sk-… LLM_COMPLETE_LIVE=1 npm test
```

Or a one-shot CLI (cwd = this directory):

```bash
OPENAI_API_KEY=sk-… node ./bin/complete.js --in payloads/hello.json
```

Env:

| Variable | Meaning |
| --- | --- |
| `OPENAI_API_KEY` | required for live |
| `LLM_PROVIDER` | must be `openai` (default) |
| `OPENAI_MODEL` | default `gpt-4o-mini` |
| `OPENAI_BASE_URL` | default `https://api.openai.com/v1` |

---

## From a Cursor agent (beside MCP)

1. Attach rd-os MCP from `consumers/cursor-mcp` (unchanged).
2. For a completion, exec this consumer — do not invent a second MCP server:

```bash
OPENAI_API_KEY=$OPENAI_API_KEY node consumers/llm-complete/bin/complete.js --in consumers/llm-complete/payloads/hello.json
```

Or require the adapter:

```js
const { complete } = require("./src/providers");
const result = await complete({ prompt: "Reply with the single word pong." });
if (!result.ok && result.code === "RESOURCE_EXHAUSTED") {
  // STOP. Do not retry. Notes=quota-blocked.
}
```

Human merge only. Dual-gate PASS elsewhere is not a 14-day PASS.
