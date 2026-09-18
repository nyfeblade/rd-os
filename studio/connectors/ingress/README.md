# studio/connectors/ingress

GitHub + Slack webhook stubs → Studio Ingest Schema → `runtime.ingest` → inbox dump.

```bash
node studio/connectors/ingress/prove.js
# exit 0

node studio/connectors/ingress/prove.js --dump
# writes inbox JSON (default: $TMPDIR/studio-ingress-inbox.json)

node studio/connectors/ingress/prove.js --gate studio/connectors/ingress/fixtures/good
# exit 0

node studio/connectors/ingress/prove.js --gate studio/connectors/ingress/fixtures/planted
# exit 2
```

Node 18+. No npm install. No live secrets. Fixture HMAC is enough. `verdict` stays null. `clock_started` stays false.
