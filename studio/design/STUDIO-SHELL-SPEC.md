# AI Coding Studio — product SoT (LOCK)

**narrative:** `PRODUCT-NARRATIVE.md` — Studio = Grok Bot capability set, **OPTIMIZED FOR ENGINEERING** (full caps)  
**status:** PRODUCT LAW (Luke) + PRODUCT LOCK + LAYOUT LOCK (Luke 2026-09-18)  
**product law:** `PRODUCT-LAW.md` + `PRODUCT-NARRATIVE.md` — Studio = everything Grok Bot can do, **OPTIMIZED FOR ENGINEERING**  
**kills:** Waiting-table-as-home · greyscale interrupt desk as product SoT · equal three-column forever · code forced open · life-OS theater  
**supersedes:** `/workspace/rd-os-design/desktop/*` Waiting-home direction for **product UX**; `three-pane.html` **Code-always-on** claim  
**keeps:** `attention.dump` / board packets as **data** under the hood; eng fences for CA  
**surface:** local-first desktop (Mac + Win) — Tauri or equivalent  
**Studio Designer:** spec + mock only — no CA launch  
**layout lock:** `LAYOUT-LOCK.md` — default **Chat + Board**; Code on demand (**unchanged**)  

---

## PRODUCT LAW
Studio is **Grok-complete**: every Grok Bot capability exists here.  
It is **not** a lifestyle OS, personal dashboard, or wellness shell.  
Those capabilities are **mapped into engineering surfaces** and shown in the locked chrome — not as extra homes.

| Grok capability | Studio surface | Where it lives |
| --- | --- | --- |
| seats | In-studio-only workers | Chat list |
| rooms | Multi-seat threads | Chat list |
| routines | Scheduled eng loops | Board + Chat (not a morning-brief home) |
| skills | Installable eng skills | Seat/room tools |
| memory | Seat / repo / envelope recall | Whisper + Chat; ships work, not a diary |
| connectors | Auth’d tools | Chrome whisper — **GitHub first** |
| CloudAgents | Agents that attach and work | Seats (Studio does not launch CAs as a product) |
| Proof | Measured verdicts | Board gates |

Chrome those surfaces occupy: **Chat + Board** default · **Code on demand** · hard cutover · modes · GitHub.

---

## USER JOB
Run a multi-agent engineering studio: talk to seats/rooms, run routines and skills, keep memory that ships work, attach CloudAgents, clear Proof gates, open repos **when asked** — in one immersive desktop.

## PRIMARY OUTCOME
Default chrome is **two surfaces**: Chat · Board.  
Code is **not** automatic and **not** always-on. It opens on demand (toolbar “Code”, link in chat, open file/diff) and can close.

Still true: immersive desktop; in-studio-only seats; connectors/presence whisper; Grok-clean vibe.  
Never a thin single-column “Waiting” home. Never a life-OS home.

## STORY
Grok Bot, optimized for engineering — Cursor × GitHub × multi-agent control room. Density and presence. Not a status website, not an IDE that never shuts up, not a life OS.

---

## HARD CUTOVER UX
- Seats that join the studio show **in-studio-only** (badge + copy): work happens here, not parallel drive-by chat.
- Connecting a seat = cutover acknowledgment (one confirm): “This seat works in Studio only while connected.”
- Presence list = who’s online **in studio** now.
- CloudAgents attach as seats under the same cutover. Studio does **not** launch CAs.

---

## MODES
Modes change how Chat + Board think (e.g. think / ship / review).  
They do **not** replace chrome, force Code open, or become a life-OS switcher (coach, journal, morning brief).

---

## IA — DEFAULT CHAT + BOARD (Code on demand)

Desktop window default **1440×900**, min **1200×720**. Panes resizable; **never** collapse to a single tab column as the default chrome.  
**Never** force equal three-column chrome. `three-pane.html` is a denser wire of all three surfaces **when Code is open** — not the default.

```
Default (Code closed)
+-------------------------------------------------------------+
| Studio          [Code]  mode  connectors whisper (GitHub) * |
+-------------------------------+-----------------------------+
| 1 CHAT                        | 2 BOARD                     |
| Seats / rooms                 | Gates / Proof / routines    |
| skills · memory · composer    | approve/reject              |
+-------------------------------+-----------------------------+

On demand (Code open)
+-------------------------------------------------------------+
| Studio          [Code on] mode  connectors whisper        * |
+--------------+----------------------------+-----------------+
| 1 CHAT       | 2 CODE                     | 3 BOARD         |
| Seats/rooms  | Repos / files / diff       | Gates / Proof   |
| thread       | Close returns to default   | approve/reject  |
+--------------+----------------------------+-----------------+
```

### Pane 1 — Chat (seats / rooms)
- List: seats + rooms; presence dot; **in-studio-only** chip on cutover seats
- Thread: messages for selected seat/room
- Composer: send to seat/room
- Skills and memory show up **in the thread / seat**, not as a lifestyle sidebar
- Density: list + thread like Slack/Cursor agent sidebar — not a marketing card
- May offer “Open code” when a file/diff is relevant — does **not** auto-open Code

### Pane 2 — Code (repos) — **on demand**
- Hidden on cold open
- Opens from: toolbar “Code”, chat link, open file/diff
- Closes from: toolbar toggle, Code “Close”
- When open: repo switcher + file tree; file view / diff / open buffer (stub OK in first shell)
- Feels like GitHub + editor chrome, not a link-out stub only

### Pane 3 — Board (gates / Proof / routines)
- Always in the default chrome (with Chat)
- P0 / waiting-on / open gates / Proof / experiment / routine rows (data from dump/board)
- Approve / Reject / resolve gate **here** (not a separate Waiting home)
- Comparable columns; greyscale OK initially — accent only for primary commit later

### Chrome
- **Code** control in the toolbar: off by default; pressed while Code is open
- **Mode** control: eng modes only; does not break layout lock
- **Connectors tray** (top, whisper): **GitHub first**, then Cursor/CloudAgent, Notion, … — connected / needs auth
- **Presence**: who’s online (seats + humans if any)
- Window: native Mac/Win titlebar; immersive content below

---

## VISUAL (desktop Mac+Win)

- Dense, tool-like (Cursor/GitHub), light or dark — **ship dark immersive default** for studio feel; ensure contrast a11y
- Preferred visual: `quiet-studio.html` (Grok-clean). Polish the shell lane against that mock.
- `three-pane.html` remains the denser three-surface wire — **superseded** for any Code-always-on claim
- Not: thin top-tabs-only app; not Ink Desk costume; not Waiting-as-home; not an IDE that never shuts up; not life-OS theater
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
      ChatPane.tsx             # seats, rooms, skills, memory
      CodePane.tsx             # mounted only when open
      BoardPane.tsx            # Proof, gates, routines
    chrome/
      ConnectorsTray.tsx       # GitHub first
      PresenceBar.tsx
      ModeControl.tsx          # eng modes only
```

**Fence for CA:** do not delete board/kernel; **do** stop treating Waiting route as home. Board pane consumes dump.  
**Do not** ship Code as always-on chrome.  
**Do not** ship a life-OS home or extra capability dashboard.

---

## ACCEPTANCE

1. Cold open: **Chat + Board** visible; Code **not** shown  
2. Code opens on demand (toolbar “Code”, chat link, open file/diff) and can close  
3. Chat shows seats + rooms + thread + composer; cutover seats show **in-studio-only**  
4. When open, Code shows repo/tree (fixture OK)  
5. Board shows gates / Proof / routines + actions  
6. Connectors tray visible (whisper); **GitHub** present; presence count visible  
7. Modes do not force Code open or replace Chat + Board  
8. Seats, rooms, routines, skills, memory, connectors, CloudAgents, Proof are reachable **inside** Chat / Board / Code-on-demand — no extra life home  
9. No Waiting-table-as-sole-home  
10. No equal three-column forever; no code forced open; no life-OS theater  

## OUT
Greyscale Waiting as product home; single-column tab shell; glass HUD theater; Studio launching CAs; Code-always-on / equal three-column forever; life-OS theater (morning brief, journal, coach, personal CRM as chrome).

## ARTIFACTS
- `PRODUCT-LAW.md`  
- `PRODUCT-NARRATIVE.md`  
- `LAYOUT-LOCK.md`  
- This spec  
- `quiet-studio.html` preferred mock (toggle Code)  
- `three-pane.html` denser wire (superseded for Code-always-on)
