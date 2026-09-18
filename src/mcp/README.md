# `src/mcp/` — CA2 control-plane MCP

In-process tool contract for board / packet / lock / proof / gate / budget.

```js
const { createMcpContract } = require("./src/mcp");
const mcp = createMcpContract({ home });
mcp.dispatch("lock.acquire", { holder: "writer", idempotency_key: "acq-1" }, { actor: "writer" });
```

- `adapters/plane.js` loads CA1 `src/board` when present, else the stub.
- `gates.js` is MCP-owned until CA1 adds gates.
- Mutators require `idempotency_key`. `RESOURCE_EXHAUSTED` means STOP.
- Not wired into `bin/mcp.js` (out of fence). Stranger: `node contracts/run.js`.
- Does not arm kill14d.
