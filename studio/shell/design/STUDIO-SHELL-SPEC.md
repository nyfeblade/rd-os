# AI Coding Studio — product SoT (LOCK)

**North star:** homebase for **ANY AI developer** (daily driver, stranger cold-open, multi-provider).  
**Law:** Grok Bot caps **optimized for eng** — see [PRODUCT-NARRATIVE.md](./PRODUCT-NARRATIVE.md).
(seats, routines→board watches, skills→modes, connectors, CA map, Proof gates).  
See [PRODUCT-NARRATIVE.md](./PRODUCT-NARRATIVE.md).

**Layout:** Chat | Board default · **Code on demand** ([LAYOUT-LOCK.md](./LAYOUT-LOCK.md)) · Waiting-home DEAD  


## USER JOB
Daily-drive AI development: talk to agents/rooms, clear gates on the board, open code when needed — any provider, stranger-friendly.

## PRIMARY OUTCOME
Default **Chat | Board** always on. **Code on demand** (not automatic). Never Waiting-table-as-home.

## STORY
Grok Bot optimized for engineering — seats/rooms, board watches, modes, connectors, CA map, Proof gates. Quiet chrome; code only when a diff matters.

---

## HARD CUTOVER UX
- Seats that join the studio show **in-studio-only** (badge + copy): work happens here, not parallel drive-by chat.
- Connecting a seat = cutover acknowledgment (one confirm): “This seat works in Studio only while connected.”
- Presence list = who’s online **in studio** now.

---

## IA — SURFACES (Chat | Board default; Code on demand)

Desktop window default **1440×900**, min **1200×720**. Chat + Board resizable; Code slides in on demand. Never Waiting-as-home; never Code forced open.

```
┌─────────────────────────────────────────────────────────────┐
│ AI Coding Studio          [connectors ▾]  ● 3 online   ▢ □ ✕│
├──────────────┬────────────────────────────┬─────────────────┤
│ 1 CHAT       │ 2 CODE                     │ 3 BOARD         │
│ Seats/rooms  │ Repos / files / diff       │ Gates / P0      │
│ thread       │ editor or tree + preview   │ experiments     │
│ composer     │                            │ approve/reject  │
└──────────────┴────────────────────────────┴─────────────────┘
```

### Pane 1 — Chat (seats / rooms)
- List: seats + rooms; presence dot; **in-studio-only** chip on cutover seats
- Thread: messages for selected seat/room
- Composer: send to seat/room
- Density: list + thread like Slack/Cursor agent sidebar — not a marketing card

### Pane 2 — Code (repos)
- Repo switcher + file tree
- Main: file view / diff / open buffer (stub OK in first shell: tree + file preview)
- Feels like GitHub + editor chrome, not a link-out stub only

### Pane 3 — Board (gates)
- P0 / waiting-on / open gates / experiment rows (data from dump/board)
- Approve / Reject / resolve gate **here** (not a separate Waiting home)
- Comparable columns; greyscale OK initially — accent only for primary commit later

### Chrome
- **Connectors tray** (top): GitHub, Cursor/CloudAgent, Notion, … — connected / needs auth
- **Presence**: who’s online (seats + humans if any)
- Window: native Mac/Win titlebar; immersive content below

---

## VISUAL (desktop Mac+Win)

- Dense, tool-like (Cursor/GitHub), light or dark — **ship dark immersive default** for studio feel; ensure contrast a11y
- Not: thin top-tabs-only app; not Ink Desk costume; not Waiting-as-home
- Pane splitters: 1px hairline, drag targets ≥4px
- Presence: 6px dot; online / away / offline
- in-studio-only: small pill, always visible on cutover seats

Tokens (starter — eng may refine):
```
--bg: #0e0e10
--pane: #161618
--line: #2a2a2e
--ink: #e8e8ea
--ink-2: #9a9aa2
--accent: #6b8afd   /* one accent — primary send / approve only */
--online: #3dd68c
```

---

## FILE MAP (repo)

```
studio/shell/
  renderer/
    app.js
    chrome/connectors-tray.js
    chrome/modes-rail.js
    chrome/presence-bar.js
    panes/chat-pane.js
    panes/board-pane.js
    panes/code-drawer.js
```

Live chrome follows **PRIMARY OUTCOME**: Chat | Board default; Code on demand. `studio/design/**` is read-only. Connectors tray consumes `studio/connectors/CATALOG.md` (P0). Seats consume `studio/seats` types (not a Luke fleet).

**Fence for CA:** do not delete board/kernel; **do** stop treating Waiting route as home. Board pane consumes dump.

---

## ACCEPTANCE

1. Cold open: **Chat | Board** visible; **Code closed** until asked  
2. Chat shows You + Grok / Claude / Cursor + Agents room + thread + composer  
3. Code stays a drawer (fixture OK) — generic repo, not a fleet checkout  
4. Board empty-state or gates/P0 + Approve/Reject; Agent map + Proof instruments  
5. Connectors tray shows catalog **P0** (needs-auth) + “Connect GitHub / an agent provider”  
6. Cutover seats show **in-studio-only**  
7. No Waiting-table-as-sole-home; no fleet-only roster  

## OUT
Greyscale Waiting as product home; single-column tab shell; glass HUD theater; Studio launching CAs.

## ARTIFACTS
- This spec  
- `three-pane.html` mock (same folder)
