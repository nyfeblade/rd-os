# AI Coding Studio — product SoT (LOCK)

**status:** PRODUCT LOCK (Luke approved via Elon) + LAYOUT LOCK (Luke 2026-09-18)  
**kills:** Waiting-table-as-home · greyscale interrupt desk as product SoT · equal three-column forever · code forced open  
**supersedes:** `/workspace/rd-os-design/desktop/*` Waiting-home direction for **product UX**; `three-pane.html` **Code-always-on** claim  
**keeps:** `attention.dump` / board packets as **data** under the hood; eng fences for CA  
**surface:** local-first desktop (Mac + Win) — Tauri or equivalent  
**Studio Designer:** spec + mock only — no CA launch  
**layout lock:** `LAYOUT-LOCK.md` — default **Chat + Board**; Code on demand  

---

## USER JOB
Run a multi-agent coding studio: talk to seats/rooms, see repos/code **when asked**, clear board gates — in one immersive desktop.

## PRIMARY OUTCOME
Default chrome is **two surfaces**: Chat · Board.  
Code is **not** automatic and **not** always-on. It opens on demand (toolbar “Code”, link in chat, open file/diff) and can close.

Still true: immersive desktop; in-studio-only seats; connectors/presence whisper; Grok-clean vibe.  
Never a thin single-column “Waiting” home.

## STORY
Cursor × GitHub × multi-agent control room — density and presence, not a status website, not an IDE that never shuts up.

---

## HARD CUTOVER UX
- Seats that join the studio show **in-studio-only** (badge + copy): work happens here, not parallel drive-by chat.
- Connecting a seat = cutover acknowledgment (one confirm): “This seat works in Studio only while connected.”
- Presence list = who’s online **in studio** now.

---

## IA — DEFAULT CHAT + BOARD (Code on demand)

Desktop window default **1440×900**, min **1200×720**. Panes resizable; **never** collapse to a single tab column as the default chrome.  
**Never** force equal three-column chrome. `three-pane.html` is a denser wire of all three surfaces **when Code is open** — not the default.

```
Default (Code closed)
+-------------------------------------------------------------+
| Studio                    [Code]   connectors whisper  * 3  |
+-------------------------------+-----------------------------+
| 1 CHAT                        | 2 BOARD                     |
| Seats/rooms · thread          | Gates / P0                  |
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

### Pane 3 — Board (gates)
- Always in the default chrome (with Chat)
- P0 / waiting-on / open gates / experiment rows (data from dump/board)
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
- Preferred visual: `quiet-studio.html` (Grok-clean). Polish the shell lane against that mock.
- `three-pane.html` remains the denser three-surface wire — **superseded** for any Code-always-on claim
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

`quiet-studio.html` may use a quieter token set; treat that file as the preferred look.

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
2. Code opens on demand (toolbar “Code”, chat link, open file/diff) and can close  
3. Chat shows seat/room list + thread + composer  
4. When open, Code shows repo/tree (fixture OK)  
5. Board shows gates/P0 + actions  
6. Connectors tray visible (whisper); presence count visible  
7. Cutover seats show **in-studio-only**  
8. No Waiting-table-as-sole-home  
9. No equal three-column forever; no code forced open  

## OUT
Greyscale Waiting as product home; single-column tab shell; glass HUD theater; Studio launching CAs; Code-always-on / equal three-column forever.

## ARTIFACTS
- `LAYOUT-LOCK.md`  
- This spec  
- `quiet-studio.html` preferred mock (toggle Code)  
- `three-pane.html` denser wire (superseded for Code-always-on)
