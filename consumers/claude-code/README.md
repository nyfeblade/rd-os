# Claude Code attach consumer

Docs-only spike. A stranger **installs rd-os from `main`** and runs **that lab's** `npm run mcp-smoke` (attach-relevant) or `npm run dual-gate` (full stranger lab). This directory is not the kernel, not a second Waiting UI, and not a CSS change.

Pinned lab: [`4151510`](https://github.com/nyfeblade/rd-os/commit/4151510ad70bf4719b6c5391836348e4db05636b) — usable lab + Eng Proof + Cursor MCP already on `main`.

`verdict` stays null. `clock_started` stays false. Dual-gate PASS is not a 14-day PASS.

---

## Cold stranger path (clone `main`, then mcp-smoke)

Requires Node 18+. No `npm install` in the lab — rd-os has no runtime deps. This is the honest attach check: the stdio server Claude Code will spawn.

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os
git checkout 4151510ad70bf4719b6c5391836348e4db05636b
npm run mcp-smoke
echo "exit=$?"
```

Expected: **exit 0**. PASS line:

```
PASS mcp-smoke (initialize + tools/list + attention.dump + steer.gate NOT_HUMAN)
```

Full stranger lab (board + MCP + Waiting UI + day-0 kill; not a 14d verdict):

```bash
chmod +x scripts/*.sh
npm run dual-gate
echo "exit=$?"
```

Expected last line:

```
PASS dual-gate (stranger + measure + proof-layer + kill14d day0; not a 14d verdict)
```

That is not a 14-day verdict. Human merge only.

---

## This consumer (install `main`, then mcp-smoke)

Same measurement, but the lab is an **installed package** (`github:nyfeblade/rd-os#4151510…`), not this working tree.

```bash
cd consumers/claude-code
npm install
npm run mcp-smoke
echo "exit=$?"
```

`npm install` fetches the pinned `main` lab into `node_modules/rd-os`. `npm run mcp-smoke` resolves that package and execs **its** `npm run mcp-smoke`. The installed tree is `main` `4151510` (has `consumers/eng-proof` and `consumers/cursor-mcp`; it does not have this `consumers/claude-code/` until this PR merges).

Broader lab check against the same installed tree:

```bash
npm run dual-gate
echo "exit=$?"
```

Override the lab root only if you must (still must be an rd-os tree, not this consumer):

```bash
RDOS_LAB=/path/to/rd-os-main npm run mcp-smoke
```

---

## Claude Code attach (recipe only)

No second UI. After the lab is cloned or installed, attach the stdio server already on `main`. Claude Code reads project servers from **`.mcp.json`** at the project root (not `.cursor/mcp.json`, not `~/.claude/mcp.json`). Approve the server on first session (`/mcp`), or add it with the CLI.

### `.mcp.json` — lab checkout (cwd = rd-os root)

```json
{
  "mcpServers": {
    "rd-os": {
      "type": "stdio",
      "command": "node",
      "args": ["bin/mcp.js"],
      "env": {
        "RDOS_HOME": "./var",
        "RDOS_ACTOR": "agent"
      }
    }
  }
}
```

### `.mcp.json` — this directory as the Claude Code project

Committed at `consumers/claude-code/.mcp.json`:

```json
{
  "mcpServers": {
    "rd-os": {
      "type": "stdio",
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

### `.mcp.json` — installed package (cwd = this consumer after `npm install`)

```json
{
  "mcpServers": {
    "rd-os": {
      "type": "stdio",
      "command": "node",
      "args": ["node_modules/rd-os/bin/mcp.js"],
      "env": {
        "RDOS_HOME": "node_modules/rd-os/var",
        "RDOS_ACTOR": "agent"
      }
    }
  }
}
```

From a checkout whose cwd is not the lab root, use absolute paths for `args` and `RDOS_HOME`.

### CLI (stdio + env)

`--env` cannot sit immediately before the server name; put `--transport stdio` between them. Everything after `--` is the lab server command:

```bash
claude mcp add \
  --env RDOS_HOME=./var \
  --env RDOS_ACTOR=agent \
  --transport stdio \
  --scope project \
  rd-os -- node bin/mcp.js
```

User-scope (all projects), absolute paths:

```bash
claude mcp add \
  --env RDOS_HOME=/absolute/path/to/rd-os/var \
  --env RDOS_ACTOR=agent \
  --transport stdio \
  --scope user \
  rd-os -- node /absolute/path/to/rd-os/bin/mcp.js
```

Check: `claude mcp list` (expect `rd-os` connected after approve). Inside a session: `/mcp`.

### Settings (enable project `.mcp.json`, do not commit)

Claude Code does **not** put MCP servers in `settings.json`. That file only approves project servers. After you trust the workspace, a local (untracked) `.claude/settings.local.json`:

```json
{
  "enabledMcpjsonServers": ["rd-os"]
}
```

Do not commit `enableAllProjectMcpServers` / `enabledMcpjsonServers` in-repo. A cloned tree cannot approve its own servers until the workspace is trusted.

Equivalent shell (no Claude Code): `RDOS_HOME=./var RDOS_ACTOR=agent node bin/mcp.js`. Agents get `NOT_HUMAN` on `steer.gate`. Human steer stays the lab UI or `rdos steer.gate --actor human`.

---

## TODO (not this PR)

A full Claude Code **API** consumer — rd-os calling Claude as a model, not Claude Code attaching **to** this lab — needs CA3 `llm.complete`. That provider API is still landing elsewhere. This directory stays docs + install-harness only.

---

## What this does not do

- Does not implement `llm.complete` / a CA3 provider.
- Does not start Waiting / `bin/lab.js`.
- Does not start the 14-day clock. Dual-gate PASS elsewhere is not a 14-day PASS.
- Does not rewrite the kernel, board, lock, UI, or CSS.
