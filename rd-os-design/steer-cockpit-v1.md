# R&D OS — customer-facing product design v1
# Studio Designer → Elon / Eng Lead (feed CA as follow-up; do not parallel-thrash bc-d611b2ff)

USER JOB: run agent experiments and clear the one thing waiting on me — without reading eng docs.
PRIMARY ACTION: resolve the top waiting item (approve plan, reject bad claim, or clear a human gate).

SoT for eng: `attention.dump` + board packets. UI is a view — never a second store.
Audience: cold user. HARD LAW lives in the product as behavior + plain labels, not as lab jargon chrome.

---

## IA / NAV

App shell (desktop, one window). Linear/Raycast density. Left rail 200px or top tabs — pick one; default **top tabs** for cold clarity.

| Route | Label (UI) | Job |
| --- | --- | --- |
| `/` | **Waiting** | P0 + actions (home) |
| `/experiments` | **Experiments** | list open / finished / killed |
| `/experiments/:id` | (detail) | machine-time, probes, claims, gates |
| `/history` | **History** | envelope baselines (how long past work took) |
| `/settings` | **Settings** | mute SFX, reduced motion, theme |

First open → **Waiting**. Never land on a JSON dump or empty dashboard of tiles.

Empty / error / loading (whole app):
- **Empty Waiting:** “Nothing waiting. Open an experiment to start.” + primary CTA → new experiment (eng wires to `experiment.open`).
- **Empty Experiments:** same CTA.
- **Empty History:** “No finished baselines yet.” secondary, no CTA panic.
- **Dump / board missing:** full-page “Can’t reach the board” + retry. never invent P0.
- **Loading:** skeleton rows (3), no spinner theater.

---

## VISUAL SYSTEM

Density: Raycast / Linear. Dark default.

| Role | Use | Token start |
| --- | --- | --- |
| void | outside plate | `#000000` |
| plate | single window surface | brand dark + ≤12% white tint (glass skill if native vibrancy) |
| text primary | body / titles | `#ededed` |
| text secondary | meta / chrome | `#a0a0a0` |
| hairline | splits | `rgba(255,255,255,0.08)` |
| accent | one blue — primary CTA + human-waiting | one only |
| danger | Reject only | quiet red |
| warning | waiting on proof | muted amber |

Type: 13/14 body, 11 meta, 16 section. Spacing 4-base (8/12/16/24). Radius 16 plate; rows r6. One plate — rows not tiles. No cyan frame, no HUD rings.

If dark glass plate: run `@raycast-glass-vercel-color-check` (native frost; css blur only if no vibrancy; search not a nested card).

---

## WAITING (home) — layout

```
┌─ app chrome: Waiting · Experiments · History · Settings ─┐
│                                                          │
│  NEEDS YOU                          age · 12m            │  ← only if waiting_on=human
│  Plan ready to approve — merge gate                      │
│  [Approve]  [Reject]  [Details]                          │
│                                                          │
│  ─ also in flight ─────────────────────────────────────  │
│  Eng Proof checking claims …                    4m       │  ← waiting_on=proof
│  Agent running probes …                         1h       │  ← waiting_on=agent
│                                                          │
│  Open gates                                              │
│  · merge on exp-…                                        │
│                                                          │
│  Last similar run: 2.0 CA hours · or “No baseline yet”   │
└──────────────────────────────────────────────────────────┘
```

Cold-user mapping from dump (do not show raw field names):

| dump | UI |
| --- | --- |
| `p0.waiting_on=human` | hero “NEEDS YOU” + Approve/Reject |
| `p0.waiting_on=proof` | secondary row “Checking claims…” |
| `p0.waiting_on=agent` | secondary row “Agent working…” |
| `p0.why` | one plain sentence under title (rewrite eng strings in UI copy layer) |
| `p0.age_s` | `12m` / `2h` |
| `hard_law[]` | **not a chip strip on home.** enforce in rejects + Settings → “Rules” plain list if needed |
| `open_gates[]` | “Open gates” rows with human labels (`merge`, not `exp:merge` only) |
| `envelope_hint` | “Last similar run: N CA hours” / “No baseline yet” |

Primary buttons **only** when NEEDS YOU. Otherwise Details is the only action on secondary rows.

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
- Focus: visible 2px accent ring on controls; never plate-only focus.
- Reject flow: confirm sheet with reason codes in plain language; optional “add constraint” (physics/human gate) — not a vibe override.
- Approve: one confirm if merge gate; then waiting row clears on next dump.
- Reduced motion: instant swaps, no shake.
- Copy layer: eng/kernel strings → plain English in UI (table in eng brief).

---

## MOTION / SFX

| event | motion | sfx |
| --- | --- | --- |
| dump refresh | crossfade copy 120ms | — |
| → NEEDS YOU | accent rim on plate 160ms | soft tick (mute default) |
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
6. Glass bar: one plate; native frost preferred; pass `@raycast-glass-vercel-color-check` if glass material used.
7. Keyboard path completes Approve from Waiting without mouse.
8. Screenshots required for Proof: empty / NEEDS YOU / proof-waiting / agent-waiting / reject sheet / experiments list.

## FAILS (design bar)

- eng-lab dump viewer as the product
- HARD LAW chip strip as primary home chrome
- tile dashboard / cinematic HUD / glass theater
- hero without empty/error/settings
- motion or SFX as decoration
- Windows Raycast as reference

## OUT

Fleet map, chat, Sightline host rebuild, second CA panel, writing MCP/board runtime, launching CAs, merge.

## HANDOFF

Elon feeds this to Eng Lead / live CA `bc-d611b2ff` as UI follow-up when PR opens. Studio Designer reviews live surface/PR against this bar; quiet when green.
