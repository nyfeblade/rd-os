# Cursor MCP attach consumer

Second real consumer after `consumers/eng-proof`. Eng Proof PR#4 shipped a **docs-only** Cursor MCP snippet. This directory **measures** stdio attach to the existing lab server: `../../bin/mcp.js`.

Not the kernel. Not a second Waiting UI. Not a 14-day PASS. `verdict` stays null. `clock_started` stays false. ResourceExhausted ⇒ STOP, no retry.

Pinned parent: this checkout (`file:../..`), which is rd-os `main` at [`0964afe`](https://github.com/nyfeblade/rd-os/commit/0964afea818511a63de17afdcde697f347509769) plus this consumer.

---

## Cold stranger path (clone → this directory → one command)

Requires Node 18+. No UI. No `kill14d` clock.

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os/consumers/cursor-mcp
npm test
echo "exit=$?"
```

Expected: **exit 0**. `npm test` spawns `../../bin/mcp.js` over stdio, lists tools, and submits a weight-only claim.

Printed evidence (shape):

```
cursor-mcp: attach stdio …/bin/mcp.js
PASS tools/list includes MCP_CONTRACT tools
PASS WEIGHT_ONLY reject code=WEIGHT_ONLY
PASS cursor-mcp (measured MCP attach + WEIGHT_ONLY; wall_ms=…; not a 14d verdict)
```

`npm install` is optional. It links the parent via `file:../..`. The smoke already falls back to `../../bin/mcp.js` on a clone.

Override the lab root only if you must (still must be an rd-os tree, not this consumer):

```bash
RDOS_LAB=/path/to/rd-os-main npm test
```

---

## Dual-gate (Eng Proof, no UI)

This consumer is the MCP attach gate. Eng Proof can cold-run it from `consumers/cursor-mcp` without starting Waiting / `bin/lab.js`:

```bash
cd consumers/cursor-mcp
npm test
```

That is **not** the lab `npm run dual-gate` (board + UI + day-0 kill). Do not start the 14-day clock from here. Dual-gate PASS elsewhere is not a 14-day PASS.

From the repo root:

```bash
npm run consumer:cursor-mcp
```

---

## Cursor attach (`.cursor/mcp.json`)

Committed project config (cwd = `consumers/cursor-mcp`):

```json
{
  "mcpServers": {
    "rd-os": {
      "command": "node",
      "args": ["../../bin/mcp.js"],
      "env": {
        "RDOS_HOME": "../../var",
        "RDOS_ACTOR": "agent"
      }
    }
  }
}
```

Open this directory as the Cursor project, or paste the snippet into Cursor Settings → MCP.

Print the same snippet plus absolute paths for any cwd:

```bash
npm run attach
```

`--write-absolute` overwrites `.cursor/mcp.json` with machine-local paths (do not commit that).

Equivalent shell: `RDOS_HOME=../../var RDOS_ACTOR=agent node ../../bin/mcp.js`. Agents get `NOT_HUMAN` on `steer.gate`. Human steer stays the lab UI or `rdos steer.gate --actor human`.

---

## What the smoke measures

1. Committed `.cursor/mcp.json` points at `../../bin/mcp.js` with `RDOS_HOME=../../var`.
2. `initialize` returns `serverInfo.name = "rd-os"`.
3. `tools/list` includes every tool named in the `MCP_CONTRACT.md` Tool surface table.
4. `claim.submit` with `payloads/weight-only.json` (`LGTM` / 90% confidence, no instrument packet) returns `{ ok: false, code: "WEIGHT_ONLY" }`.

That is measured attach. It is not a 14-day verdict. Human merge only.
