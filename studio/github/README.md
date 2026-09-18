# Studio C — GitHub browse / connector UI

Fence: **`studio/github/` only**. Not `studio/shell/`, not `studio/seats/`, not `desktop/`, not the kernel, not `consumers/`.

GitHub-like repo browse plus the first connector attach recipe. Grok / Claude / Cursor seats are **stubs** so a later max-connector wire has a place to land. Human+AI coding surface hooks are the file tree and PR list (coding pane is a stub).

Not a 14-day PASS. `verdict` stays null. `clock_started` stays false. ResourceExhausted ⇒ STOP, no retry.

---

## Cold stranger path (clone → this directory → one command)

Requires Node 18+. No `npm install`. No token. Fixture browse is the default.

```bash
git clone https://github.com/nyfeblade/rd-os.git
cd rd-os/studio/github
npm test
echo "exit=$?"
```

Expected: **exit 0**.

```
PASS connector scaffold github ready + grok/claude/cursor stubs
PASS github attach recipe
PASS fixture repo browse (tree / blob / pulls)
PASS attach github + stub seats
PASS human+AI surface hooks (file-tree / pr-list / coding-surface)
PASS RESOURCE_EXHAUSTED rate limit fetch_calls=1 (no retry)
PASS RESOURCE_EXHAUSTED 429 fetch_calls=1 (no retry)
PASS http browse + recipe + surface
PASS studio-github (browse + attach recipe + stubs + surface hooks; wall_ms=…; not a 14d verdict)
```

Then open the UI:

```bash
npm start
```

Browse: [http://127.0.0.1:7430](http://127.0.0.1:7430) — Code / Pull requests / Connectors / Surface.

---

## Connector attach recipe (GitHub first)

Print the committed recipe:

```bash
npm run attach
```

```json
{
  "connector": "github",
  "kind": "repo",
  "status": "ready",
  "cli": "node ./bin/studio.js",
  "env": {
    "STUDIO_SOURCE": "github",
    "GITHUB_REPO": "nyfeblade/rd-os",
    "GITHUB_TOKEN": "<optional for public repos; never commit>"
  },
  "resource_exhausted": "STOP, no retry"
}
```

Live public browse (optional; one request, no retry):

```bash
STUDIO_SOURCE=github GITHUB_REPO=nyfeblade/rd-os npm start
```

Token is optional for public repos. HTTP 429 / rate-limit / quota ⇒ `{ ok: false, code: "RESOURCE_EXHAUSTED", stop: true }`. The UI shows **Stopped**. It does not retry GitHub. Switching to fixture browse is a source change, not a retry.

Seat stubs (`recipes/grok.json`, `recipes/claude.json`, `recipes/cursor.json`) reject `STUB_CONNECTOR`. Later wire lives in `studio/seats`. Cursor MCP attach stays `consumers/cursor-mcp`.

---

## Human+AI coding surface hooks

| Hook | Event | Status |
| --- | --- | --- |
| `[data-hook=file-tree]` | `studio:open-file` | ready |
| `[data-hook=pr-list]` | `studio:open-pr` | ready |
| `[data-hook=coding-surface]` | `studio:edit` | stub |
| `[data-hook=connector-attach]` | `studio:attach` | ready |

`window.StudioGithub.hooks` is the embed point for a later shell. This directory does not implement seats.

---

## Thin public-API client

`lib/github.js` talks to `api.github.com` (GET repo / contents / pulls). `lib/rdos-client.js` may exec the public `bin/rdos.js` CLI if present (`GET /api/rdos`). Neither imports `src/*`.

---

Human merge only. Dual-gate PASS elsewhere is not a 14-day PASS.
