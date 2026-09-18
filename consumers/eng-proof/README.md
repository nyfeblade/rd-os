# Eng Proof consumer

Harness only. A stranger **installs rd-os from `main`** and runs **that lab's** `npm run dual-gate`. This directory is not the kernel, not a second Waiting UI, and not a CSS change.

Pinned lab: [`9457cac`](https://github.com/nyfeblade/rd-os/commit/9457cac3e38fb442567fb6b1ffedeb8d9290ab00) — Exp-2 usable lab already on `main`.

`verdict` stays null. `clock_started` stays false. Dual-gate PASS is not a 14-day PASS.

---

## Cold stranger path (clone `main`, then dual-gate)

Requires Node 18+ and `curl`. No `npm install` in the lab — rd-os has no runtime deps. Proof Layer is cloned by the lab hook.

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os
git checkout 9457cac3e38fb442567fb6b1ffedeb8d9290ab00
chmod +x scripts/*.sh
npm run dual-gate
echo "exit=$?"
```

Expected: **exit 0**. Measured on a cold clone of `9457cac` (Node 22.14.0):

```
PASS stranger-check (board + MCP + Waiting UI + day0 fields; not a 14d verdict)
```

`wedge-measure` JSON: `"beats_markdown": true`, `"verdict": "KEEP_WEDGE"`.

Proof Layer hook: `"runner_result": "REJECTED"`, `"measured_exit": 1`, `"expect_exit": 0`, `"verdict": null`, first APL line `REJECTED`.

Both `kill14d` arms: `"day": 0`, `"clock_started": false`, `"verdict": null`. rdos arm: `"m1_rejected": 3`, `"m2_illegal_accepts": 0`, `"m3_weight_only_rejected": 5`, `"m4_underscope_rejected": 5`, `"m7_p0_present": true`.

Last line:

```
PASS dual-gate (stranger + measure + proof-layer + kill14d day0; not a 14d verdict)
```

That is not a 14-day verdict. Human merge only.

---

## This consumer (install `main`, then dual-gate)

Same measurement, but the lab is an **installed package** (`github:nyfeblade/rd-os#9457cac…`), not this working tree.

```bash
cd consumers/eng-proof
npm install
npm run dual-gate
echo "exit=$?"
```

`npm install` fetches the pinned `main` lab into `node_modules/rd-os` (`git+ssh://git@github.com/nyfeblade/rd-os.git#9457cac3e38fb442567fb6b1ffedeb8d9290ab00`). `npm run dual-gate` resolves that package and execs **its** `npm run dual-gate`. Measured here: **exit 0**, `eng-proof: dual-gate against installed lab …/node_modules/rd-os`, same PASS lines as the cold clone. The installed tree has no `consumers/` — it is `main`, not this PR.

Override the lab root only if you must (still must be an rd-os tree, not this consumer):

```bash
RDOS_LAB=/path/to/rd-os-main npm run dual-gate
```

---

## Cursor MCP attach (`node bin/mcp.js`)

README snippet only. No second UI. After the lab is cloned or installed, attach the stdio server already on `main`:

**`.cursor/mcp.json`** (project) or Cursor Settings → MCP:

```json
{
  "mcpServers": {
    "rd-os": {
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

From a checkout whose cwd is not the lab root, use absolute paths:

```json
{
  "mcpServers": {
    "rd-os": {
      "command": "node",
      "args": ["/absolute/path/to/rd-os/bin/mcp.js"],
      "env": {
        "RDOS_HOME": "/absolute/path/to/rd-os/var",
        "RDOS_ACTOR": "agent"
      }
    }
  }
}
```

Equivalent shell: `RDOS_HOME=./var node bin/mcp.js`. Agents get `NOT_HUMAN` on `steer.gate`. Human steer stays the lab UI or `rdos steer.gate --actor human`.
