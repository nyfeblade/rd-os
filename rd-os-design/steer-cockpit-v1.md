# R&D OS — customer-facing product design v1
# Studio Designer → Elon / Eng Lead (feed CA as follow-up; do not parallel-thrash bc-d611b2ff)

USER JOB: run agent experiments and clear the one thing waiting on me — without reading eng docs.
PRIMARY ACTION: resolve the top waiting item (approve plan, reject bad claim, or clear a human gate).

SoT for eng: `attention.dump` + board packets. UI is a view — never a second store.
Audience: cold user. HARD LAW lives in the product as behavior + plain labels, not as lab jargon chrome.

---

## IA / NAV

App shell (desktop, one window). Magic Ink greyscale information graphic. Top tabs for cold clarity.

| Route | Label (UI) | Job |
| --- | --- | --- |
| `/` | **Waiting** | P0 + actions (home) |
| `/experiments` | **Experiments** | list open / finished / killed |
| `/experiments/:id` | (detail) | machine-time, probes, claims, gates |
| `/history` | **History** | envelope baselines (how long past work took) |
| `/settings` | **Settings** | mute SFX, reduced motion, theme |

First open → **Waiting**. Never land on a JSON dump or empty dashboard of tiles.

Empty / error / loading (whole app):
- **Empty Waiting:** “Nothing waiting” + “Board is clear. Open an experiment when you want to measure something.” + New experiment (eng wires to `experiment.open`).
- **Empty Experiments:** same CTA.
- **Empty History:** “No finished baselines yet.” secondary, no CTA panic.
- **Dump / board missing:** full-page “Can’t reach the board” + retry. never invent P0.
- **Loading:** skeleton rows (3), no spinner theater.

---

## VISUAL SYSTEM

Density: Magic Ink greyscale Waiting. Light paper, not Raycast dark. No SaaS blue as the primary system. No copper Ink Desk.

SoT pixels: attached / Studio `waiting-greyscale.html`. Tokens in `ui/app.css`.

| Role | Use | Token |
| --- | --- | --- |
| bg | page paper | `#f4f4f2` |
| panel | single window surface | `#ffffff` |
| line | splits | `#d8d8d4` |
| ink | body / primary fill | `#1a1a1a` |
| ink-2 | meta / quiet rows | `#5c5c5c` |
| ink-3 | chrome / captions | `#8a8a8a` |
| row-human | human-waiting row | `#ececea` |
| focus | visible ring | `#1a1a1a` |

Type: 13 body, 11 meta/caption, 18 empty title. Radius 8 panel; 5 buttons. One panel — comparable table rows, not tiles. No cyan frame, no HUD rings, no brand accent until hierarchy reads.

Human row: grey wash + 3px ink inset on the first cell. Approve is ink fill; Reject/Details are ink outline. Status is the Waiting-on word, not a color.

---

## WAITING (home) — layout

```
┌─ Waiting · Experiments · History · Settings · now ───────┐
│ Open items · sorted by urgency                           │
│ What                         Waiting on            Age   │
│ Plan ready — merge gate…     Human                 12m   │  ← waiting_on=human
│   Agents finished probes.                                │
│   [Approve] [Reject] [Details]                           │
│ Checking claims…             Proof                  4m   │  ← waiting_on=proof
│ Running probes…              Agent              1h 02m   │  ← waiting_on=agent
│ Open gates: merge · exp-… · Last similar run: 2.0 CA h   │
└──────────────────────────────────────────────────────────┘
```

Cold-user mapping from dump (do not show raw field names):

| dump | UI |
| --- | --- |
| `p0.waiting_on=human` | human table row + Approve/Reject/Details |
| `p0.waiting_on=proof` | comparable row, Waiting on = Proof |
| `p0.waiting_on=agent` | comparable row, Waiting on = Agent |
| empty board | “Nothing waiting” + New experiment |
| open items, no human | “Open items · no human gate” |
| `p0.why` | What column (rewrite eng strings in UI copy layer) |
| `p0.age_s` | Age column `12m` / `1h 02m` |
| `hard_law[]` | **not a chip strip on home.** enforce in rejects + Settings → “Rules” plain list if needed |
| `open_gates[]` | footer “Open gates: Merge · exp-…” |
| `envelope_hint` | footer “Last similar run: N CA hours” / “No baseline yet” |

Primary ink button **only** on the human row (Approve). Reject/Details are outline. In-flight rows have no actions.

---

## EXPERIMENTS

List rows: name/id · stage · ca hours estimate · gate count · age.  
Row click → detail.

Detail sections (scannable):
1. Status + waiting reason
2. Time (CA hours, proof minutes, human gates) — **never show weeks/sprints** unless a gate is listed
3. Probes / evidence (links, exit codes — not confidence theater)
4. Claims + reject codes in plain language (`WEIGHT_ONLY` → “Rejected: score without evidence”)
5. Actions: Approve / Reject / Resolve gate

---

## INTERACTION

- Keyboard: `Enter` Approve when NEEDS YOU focused; `⌘/Ctrl+Enter` same; `Esc` back; `j/k` or arrows move rows; `/` focus filter on lists.
- Focus: visible 2px ink ring on controls; never plate-only focus.
- Reject flow: confirm sheet with reason codes in plain language; optional “add constraint” (physics/human gate) — not a vibe override.
- Approve: one confirm if merge gate; then waiting row clears on next dump.
- Reduced motion: instant swaps, no shake.
- Copy layer: eng/kernel strings → plain English in UI (table in eng brief).

---

## MOTION / SFX

| event | motion | sfx |
| --- | --- | --- |
| dump refresh | crossfade copy 120ms | — |
| → NEEDS YOU | human row wash 160ms | soft tick (mute default) |
| Approve | row settle 180ms | soft confirm |
| Reject | 2px shake 200ms (skip if reduced-motion) | short thud |
| age tick | number swap, no layout shift | — |

SFX master mute in Settings. Sparse; task-tied only. none as decoration.

---

## A11Y

- Contrast ≥ 4.5:1 body on plate; secondary ≥ 3:1 large/meta.
- Focus visible always; tab order = visual order.
- All actions reachable by keyboard.
- `prefers-reduced-motion`: disable shake + non-essential transitions; SFX off when reduced-motion unless user enables.
- Pills/status not color-only — include text label.

---

## ACCEPTANCE (eng CA / Proof)

1. Cold user on first open lands Waiting and can state what’s needed (or that nothing is) in ≤30s without docs (maps M7 intent).
2. When dump `waiting_on=human`, Approve + Reject visible without scrolling on 720×520.
3. HARD LAW not required as home chrome; product still rejects weight-only / under-scope with plain-language errors.
4. Missing dump → error empty state; zero fabricated P0.
5. No week/sprint labels unless a human gate is on screen.
6. One white panel on grey paper. No glass theater. No `#4c8dff` / copper as the system.
7. Keyboard path completes Approve from Waiting without mouse.
8. Screenshots required for Proof: empty / NEEDS YOU / proof-waiting / agent-waiting / reject sheet / experiments list.

## FAILS (design bar)

- eng-lab dump viewer as the product
- HARD LAW chip strip as primary home chrome
- tile dashboard / cinematic HUD / glass theater
- hero without empty/error/settings
- motion or SFX as decoration
- Windows Raycast as reference
- dark plate + SaaS blue accent as the primary system
- copper Ink Desk costume

## OUT

Fleet map, chat, Sightline host rebuild, second CA panel, writing MCP/board runtime, launching CAs, merge.

## HANDOFF

Elon feeds this to Eng Lead / live CA `bc-d611b2ff` as UI follow-up when PR opens. Studio Designer reviews live surface/PR against this bar; quiet when green.
