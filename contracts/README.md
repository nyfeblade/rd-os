# contracts/ — CA2 MCP contract tests

Machine-readable tool list + reject codes + stranger runner.

```bash
node contracts/run.js
```

Expect exit 0. Node 18+. No npm install. Does not start Waiting, does not attach `bin/mcp.js`, does not arm kill14d (`clock_started` stays false).

Plants live in `contracts/fixtures/`. Codes in `reject-codes.json` must match `src/mcp/reject.js`.
