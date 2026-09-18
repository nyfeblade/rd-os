# GitHub browse + connectors — any AI developer homebase

**North star:** GitHub and coding connectors as a homebase **any** AI developer can cold-open. Multi-provider (GitHub first; Grok / Claude / Cursor stubs). Stranger path is one command. No host lock-in.

Fence: **`studio/github/` only**. Not `studio/shell/`, not `studio/seats/`, not `studio/design/`, not `desktop/`, not the kernel, not `consumers/`.

This directory is the **Code pane** payload: GitHub browse + connectors as **eng surfaces** for human+AI coding (file tree, blob, PRs, attach). No life-OS theater. It does **not** own studio shell chrome: no titlebar, Chat, Board, presence, or connectors tray.

**Layout lock:** default chrome is Chat + Board. Code draws **on demand**. Three-pane-always is wrong. This pane does not assume an always-visible Code column.

Designer SoT (`studio/design/` on `main`) is consumed read-only. The shell calls `window.StudioGithub.show()` / `hide()` (or `POST /api/pane/draw|hide`). `?embed=1` starts hidden. Standalone `npm start` draws the pane so a stranger can browse.

**Product law:** browse and connectors are engineering surfaces. Not a life-OS, presence desk, or Waiting-home costume.

GitHub-like repo browse plus the first connector attach recipe. Grok / Claude / Cursor are **coding connector stubs** so a later max-connector wire has a place to land.

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

Standalone eng browse: [http://127.0.0.1:7430](http://127.0.0.1:7430) — Files / Pulls / Connectors. Embed: [http://127.0.0.1:7430/?embed=1](http://127.0.0.1:7430/?embed=1).

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

`window.StudioGithub.pane === "code"` and `draw === "on-demand"`. Shell embed: `show()` / `hide()` / `mount(host)`. Events: `studio:draw-code`, `studio:hide-code`. This directory does not implement seats or shell chrome.

---

## Thin public-API client

`lib/github.js` talks to `api.github.com` (GET repo / contents / pulls). `lib/rdos-client.js` may exec the public `bin/rdos.js` CLI if present (`GET /api/rdos`). Neither imports `src/*`.

---

Human merge only. Dual-gate PASS elsewhere is not a 14-day PASS.
