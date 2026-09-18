# AI Coding Studio — product SoT (LOCK)

**North star:** homebase for **ANY** AI developer — daily driver, not a Luke-fleet-only ops panel.  
Stranger cold-open, empty states, and onboarding must work. Multi-provider seats.  
See [PRODUCT-NARRATIVE.md](./PRODUCT-NARRATIVE.md).

**Luke law:** Studio = **full Grok Bot capability set, specialized for eng**  
(seats, rooms, routines→board watches, skills→modes, memory, connectors, agent map, Proof gates).

**Layout:** Chat | Board default · **Code on demand** ([LAYOUT-LOCK.md](./LAYOUT-LOCK.md)) · Waiting-home DEAD  
**Visibility:** [VISIBILITY.md](./VISIBILITY.md) — only necessary info by default (hide roster / full tray / idle CA map).  
**Chrome fences:** [SHELL-IA.md](./SHELL-IA.md) is authoritative (connectors tray + Code drawer).  
**Not:** three panes always visible. Code is not automatic. Not fleet-only.

---

## USER JOB
Run a multi-agent coding studio: talk to seats/rooms, see repos/code **when asked**, clear board gates — in one immersive desktop.

## PRIMARY OUTCOME
Default **Chat | Board** always on. **Code on demand** (not automatic). Never Waiting-table-as-home. Never Code forced open.

## STORY
The AI developer’s homebase: chat with agents, clear gates, open code when a diff matters — any provider, every day. Eng-optimized Grok Bot powers. Quiet chrome.

---

## HARD CUTOVER UX
- Seats that join the studio show **in-studio-only** (badge + copy): work happens here, not parallel drive-by chat.
- Connecting a seat = cutover acknowledgment (one confirm): “This seat works in Studio only while connected.”
- Presence list = who’s online **in studio** now.

---

## IA — SURFACES (Chat | Board default; Code on demand)

Desktop window default **1440×900**, min **1200×720**. Chat + Board resizable; Code slides in on demand. Never Waiting-as-home; never Code forced open.

```
Default (Code closed)
+-------------------------------------------------------------+
| Studio                    [Code]   connectors whisper  * 3  |
+-------------------------------+-----------------------------+
| 1 CHAT                        | 2 BOARD                     |
| Seats / rooms · thread        | Gates / Proof / watches     |
| composer                      | approve/reject              |
+-------------------------------+-----------------------------+

On demand (Code open)
+-------------------------------------------------------------+
| Studio                    [Code on] connectors whisper  * 3 |
+--------------+----------------------------+-----------------+
| 1 CHAT       | 2 CODE                     | 3 BOARD         |
| Seats/rooms  | Repos / files / diff       | Gates / P0      |
| thread       | Close returns to default   | approve/reject  |
+--------------+----------------------------+-----------------+
```

### Pane 1 — Chat (seats / rooms)
- List: seats + rooms; presence dot; **in-studio-only** chip on cutover seats
- Thread: messages for selected seat/room
- Composer: send to seat/room
- Density: list + thread like Slack/Cursor agent sidebar — not a marketing card
- May offer “Open code” when a file/diff is relevant — does **not** auto-open Code

### Pane 2 — Code (repos) — **on demand**
- Hidden on cold open
- Opens from: toolbar “Code”, chat link, open file/diff
- Closes from: toolbar toggle, Code “Close”
- When open: repo switcher + file tree; file view / diff / open buffer (stub OK in first shell)
- Feels like GitHub + editor chrome, not a link-out stub only

### Pane 3 — Board (gates / Proof / watches)
- Always in the default chrome (with Chat)
- P0 / waiting-on / open gates / Proof / experiment / routine-watch rows (data from dump/board)
- Approve / Reject / resolve gate **here** (not a separate Waiting home)
- Comparable columns; greyscale OK initially — accent only for primary commit later

### Chrome
- **Code** control in the toolbar: off by default; pressed while Code is open
- **Connectors tray** (top, whisper): GitHub, Cursor/CloudAgent, Notion, … — connected / needs auth
- **Presence**: who’s online (seats + humans if any)
- Window: native Mac/Win titlebar; immersive content below

---

## VISUAL (desktop Mac+Win)

- Dense, tool-like (Cursor/GitHub), light or dark — **ship dark immersive default** for studio feel; ensure contrast a11y
- Preferred visual: `quiet-studio.html` (toggle Code)
- `three-pane.html` is a denser wire of all three surfaces **when Code is open** — **superseded** for any Code-always-on claim
- Not: thin top-tabs-only app; not Ink Desk costume; not Waiting-as-home; not an IDE that never shuts up
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
desktop/   # or studio/ — Eng Lead picks fence; prefer desktop/studio UI under existing Tauri tree
  … shell …
  src/
    shell/StudioShell.tsx      # default Chat + Board; Code on demand
    panes/
      ChatPane.tsx
      CodePane.tsx             # mounted only when open
      BoardPane.tsx
    chrome/
      ConnectorsTray.tsx
      PresenceBar.tsx
```

**Fence for CA:** do not delete board/kernel; **do** stop treating Waiting route as home. Board pane consumes dump.  
**Do not** ship Code as always-on chrome.

---

## ACCEPTANCE

1. Cold open: **Chat + Board** visible; Code **not** shown  
2. Stranger understands “talk to agents” + “what’s blocked on me” in ≤30s — no fleet jargon required  
3. Connectors empty-state invites GitHub / an agent provider (not a brick wall)  
4. Code opens on demand (toolbar “Code”, chat link, open file/diff) and can close  
5. Chat shows seat/room list + thread + composer; seats are multi-provider  
6. When open, Code shows repo/tree (fixture OK)  
7. Board shows gates/P0 + actions  
8. Connectors tray visible; presence count visible  
9. Cutover seats may show **in-studio-only** (optional, not fleet-mandatory)  
10. No Waiting-table-as-sole-home  
11. No three-panes-always; no code forced open; no fleet-only chrome  

## OUT
Greyscale Waiting as product home; single-column tab shell; glass HUD theater; Studio launching CAs; Code-always-on / three panes always visible; fleet-only chrome; single-provider lock-in.

## ARTIFACTS
- [PRODUCT-NARRATIVE.md](./PRODUCT-NARRATIVE.md)  
- [LAYOUT-LOCK.md](./LAYOUT-LOCK.md)  
- This spec  
- `quiet-studio.html` preferred mock (toggle Code)  
- `three-pane.html` denser wire (superseded for Code-always-on)
