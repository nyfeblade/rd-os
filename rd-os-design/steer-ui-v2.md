# R&D OS — steer UI v2 (Studio Designer call)

ARTIFACT TYPE: app  
USER / AUDIENCE: someone running agent experiments who needs to clear what’s blocked on them — cold open, no eng walkthrough.  
ENG SoT: `attention.dump` + board packets (UI is a view).  
CA: feed as follow-up; do not parallel-thrash `bc-d611b2ff`.

**CREATIVE LOCK:** Ink Desk supersedes `steer-cockpit-v1` Raycast/Linear chrome and the later greyscale Magic Ink table for all customer-facing surface work.

---

## STORY / EMOTION

**Product story:** the desk where agent work becomes accountable.  
**Emotion:** calm authority — measured over narrated.  
**Promise on first glance:** you always know the one thing that needs you.

Not a chat. Not a fleet map. Not a lab status wall.

---

## DIRECTIONS EXPLORED

1. **Glass instrument** — frosted plate, cyan/blue accent, Raycast-adjacent. Clean, familiar, easy to over-index on material. Feels like every AI tool 2024–26.
2. **Oscilloscope lab** — mono + amber, terminal density. Honest to “instruments,” but reads as eng-lab chrome. Fails cold-user brand.
3. **Ink Desk** — warm matte ink, editorial typography, copper accent for human interrupts. Judgment desk, not dashboard.

## CHOSEN + WHY

**Ink Desk.**

Why: R&D OS’s job is judgment (approve / reject / wait). Editorial hierarchy matches that job better than glass fashion or lab nostalgia. Copper = human heat when the product needs you; everything else stays quiet ink. Differentiated without HUD theater. Production-usable; still has a point of view.

---

## IA / NAV

Top nav (text, not icon soup): **Waiting** · **Experiments** · **History** · **Settings**  
Default route: Waiting.

| Screen | Job |
| --- | --- |
| Waiting | Clear the interrupt (or see calm empty) |
| Experiments | Scan / open runs |
| Experiment detail | Time, evidence, claims, gates, actions |
| History | Past CA-hour baselines in plain language |
| Settings | Sound, motion, appearance, plain-language “Rules” |

Empty / error / loading required on every list surface (see acceptance).

---

## VISUAL SYSTEM — Ink Desk

### Color
| Role | Hex | Use |
| --- | --- | --- |
| ink-0 | `#12100E` | app ground |
| ink-1 | `#1C1916` | main panel |
| ink-2 | `#26221E` | elevated row / sheet |
| hairline | `#3A342E` | 1px rules |
| paper | `#F2EDE6` | primary text |
| paper-dim | `#9C948A` | meta (`#A89F94` if contrast needs a bump) |
| copper | `#C47A4A` | NEEDS YOU + primary CTA |
| copper-soft | `#C47A4A22` | hero wash |
| proof | `#B08D57` | waiting on proof (muted gold) |
| agent | `#7A8494` | agent in flight (cool grey) |
| danger | `#B54A3A` | Reject only |

No pure `#000` void cyber. No default SaaS blue as the brand accent. One accent family (copper).

### Type
- UI sans: Inter or system UI — **13** body, **11** meta, **12** nav.
- Decision display: **Newsreader** or **Source Serif** for the Waiting headline only (the one interrupt). If web-font cost hurts: Inter 22 semibold — still treat as display.
- Tracking: display −0.02em; meta +0.02em.
- Numbers (age, hours): tabular lining.

### Layout rhythm
- Window comfort: 780×560 default; fluid min 680×480.
- Panel padding 20; section gap 16; row height 36; hero block ~120 when NEEDS YOU.
- Radius: panel 12; controls 8; pills 999.
- **Matte panels**, not glass. No backdrop-blur. Depth = hairline + slight ink-2 lift only.

### Density
Scannable lists (Experiments/History). Waiting is intentionally **asymmetric**: one loud decision, quiet context below — not equal tiles.

---

## WAITING (home)

### NEEDS YOU state (`waiting_on=human`)
```
Waiting · Experiments · History · Settings          ● live

NEEDS YOU · 12m
Plan ready — merge gate on Exp-2 wedge
The agents finished their probes. Your call.

[ Approve plan ]   [ Reject ]   Details →
────────────────────────────────────────
In flight
  Checking claims…                         4m    proof
  Running probes…                          1h    agent

Open gates
  Merge · Exp-2 R&D OS wedge

Last similar run · 2.0 CA hours
```

### Calm empty
Large quiet line: **Nothing needs you.**  
Sub: “Open an experiment when you’re ready to measure something.”  
Text button: New experiment

### Copy layer (cold)
| eng/dump | UI |
| --- | --- |
| waiting_on human | NEEDS YOU |
| waiting_on proof | Checking claims… |
| waiting_on agent | Running probes… |
| WEIGHT_ONLY | Rejected — score without evidence |
| UNDER_SCOPE | Rejected — scope shrunk without a reason |
| NO_BASELINE | No similar run yet |
| estimate_ca_hours | Agent time · N hours |
| estimate_proof_min | Proof · N min |

Hard law: **Settings → Rules** as five plain sentences. Not home chips.

---

## EXPERIMENTS + DETAIL

**List row:** title · stage pill · Agent time · gates · age  
**Detail stack:** Status → Time → Evidence → Claims → Gates → Actions  
Ban week/sprint labels unless a human gate is visible.  
Reject codes always plain language + raw code in mono footnote for eng.

---

## INTERACTION

- Focus: 2px copper ring; never color-only state.
- Keyboard: `j/k` rows; `Enter` Approve when NEEDS YOU; `⇧Enter` Reject opens sheet; `Esc` back; `/` filter on lists.
- Reject sheet: plain reasons; optional “add a real constraint” (not vibe override).
- Approve: single confirm if merge gate present.

---

## MOTION / SFX

Sparse, story-tied.

| event | motion | sfx (mute default) |
| --- | --- | --- |
| → NEEDS YOU | copper wash 180ms fade | soft wood-tick |
| Approve | headline settles down 160ms | low confirm |
| Reject | sheet rise; no rage shake if reduced-motion | short dry click |
| list refresh | 100ms opacity | — |

`prefers-reduced-motion`: cuts motion to opacity only; SFX off unless user enables.

---

## A11Y

- Paper on ink-1 ≥ 4.5:1; paper-dim on ink-1 ≥ 3:1 for meta ≥14px or accept bump to `#A89F94`.
- Keyboard complete path for Approve/Reject.
- Status not color-only (label + color).
- Reduced motion + mute respected.

---

## ACCEPTANCE

1. Cold user states the waiting need (or calm empty) in ≤30s on first open.
2. NEEDS YOU: Approve + Reject above the fold at 780×560.
3. Missing board/dump → honest error; zero fabricated interrupt.
4. No week/sprint copy without a visible human gate.
5. Accent is copper family only for brand CTAs (danger reserved for Reject).
6. No glass blur on default theme; matte ink panels.
7. Keyboard-only Approve path works.
8. Proof screenshots: calm empty · NEEDS YOU · proof row · agent row · reject sheet · experiments list · settings rules.

## FAILS

- Default SaaS blue / generic glass as the brand
- Iron Man HUD / radar / holographic grids
- HARD LAW chip strip as home chrome
- Eng jargon (`p0`, `hard_law`, dump JSON) in customer UI
- Equal-weight tile dashboard that hides the interrupt
- Motion/SFX as decoration

## OUT

Backend/MCP/board runtime, CA launch/merge, fleet chat, Sightline rebuild.

---

## HANDOFF

Visual mock: `ink-desk-waiting.html` (same folder).  
Elon → Eng Lead / CA as UI follow-up. Studio reviews live PR against this call.
