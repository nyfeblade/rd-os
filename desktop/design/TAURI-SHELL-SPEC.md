# R&D OS — Tauri desktop shell (design SoT)

**product:** local-first Agent R&D OS  
**surface:** app chrome + nav + window; cockpit content = greyscale Waiting  
**cockpit SoT:** `/workspace/rd-os-design/waiting-greyscale.html` (table: what / waiting on / age; Approve on human row)  
**data SoT:** `attention.dump` — UI is a view  
**owner:** Studio Designer → Eng Lead CA implements; Studio does **not** launch CA  

---

## USER JOB
Run agent experiments locally and clear what’s blocked on me — cold open, no eng walkthrough.

## PRIMARY ACTION
Resolve the top human-waiting row (Approve / Reject).

## STORY
Local accountability desk. Systems hold complexity; human judges. Craft = unnoticed details after the information graphic works.

---

## IA / NAV (shell)

Window: single main window, default **960×640**, min **720×480**. Native titlebar OK (Tauri); no fake traffic-light chrome.

| Route | Label | Content |
| --- | --- | --- |
| `/waiting` | Waiting | Greyscale Waiting graphic (SoT HTML → React/Svelte/whatever eng picks) |
| `/experiments` | Experiments | List open/finished/killed (rows; ship stub empty OK in shell PR) |
| `/experiments/:id` | Detail | Machine-time + gates + claims (stub) |
| `/history` | History | Envelope baselines (stub) |
| `/settings` | Settings | Mute, reduced motion, Rules (plain HARD LAW sentences) |

Default route: **Waiting**.

Shell chrome only:
- Top nav text links (Waiting current)
- Optional status: `live` / last dump age (tabular nums) — secondary ink
- No sidebar required for v1 (top nav denser for cold user)

Empty / error / loading (shell-owned):
- Missing `$RDOS_HOME` / dump → full panel “Can’t reach the board” + path hint + Retry
- Loading → 3 skeleton rows matching Waiting table
- Empty Waiting → copy from greyscale SoT

---

## VISUAL SYSTEM (shell + cockpit)

**Greyscale first** (no brand accent until hierarchy reads in product review).

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#f4f4f2` | window ground |
| `--panel` | `#ffffff` | content panel |
| `--line` | `#d8d8d4` | hairlines |
| `--ink` | `#1a1a1a` | primary |
| `--ink-2` | `#5c5c5c` | secondary |
| `--ink-3` | `#8a8a8a` | meta / nav idle |
| `--row-human` | `#ececea` | human-waiting row wash |
| human marker | 3px inset bar `--ink` | left edge of human row |

Type: system UI stack; 13 body, 12 nav, 11 meta/caps; **tabular-nums** on ages.  
Radius: panel 8, controls 5.  
Focus: 2px ink ring, offset 2.  
**No** backdrop-blur glass. **No** copper/cyan costume.

Dark theme: park for settings later; ship light greyscale first (reduce scope).

---

## INTERACTION (shell)

- Nav: click + `1`–`4` optional shortcuts later; v1 click only OK
- Waiting: keyboard — `j/k` rows, `Enter` Approve when human row focused, `⇧Enter` Reject sheet (can stub Reject confirm)
- `Esc` clears focus / closes sheet
- Feedback on the row (Norman mapping) — not a distant toast
- `prefers-reduced-motion`: no row motion

---

## FILE MAP (repo `nyfeblade/rd-os`)

Propose eng creates:

```
desktop/                          # OR app/ — pick one; prefer desktop/
  README.md                       # how to run Tauri; points at this design SoT
  src-tauri/
    tauri.conf.json
    Cargo.toml
    src/main.rs                   # window, local path to RDOS_HOME
  src/                            # frontend
    main.tsx | main.ts
    styles/tokens.css             # greyscale tokens above
    shell/
      AppShell.tsx                # window chrome + nav + outlet
      Nav.tsx
      routes.ts
    views/
      WaitingView.tsx             # IMPLEMENT FROM waiting-greyscale.html
      ExperimentsView.tsx         # stub
      HistoryView.tsx             # stub
      SettingsView.tsx            # stub + Rules list
    lib/
      attention.ts                # read/watch attention.dump → model
      copy.ts                     # dump field → plain labels
  index.html
```

Do **not** put product UI under `board/` or `src/kernel.js`. Shell is additive.

Acceptance for shell PR (design bar):
1. Cold open lands Waiting; human row (if any) identifiable in ≤30s
2. What / waiting on / age columns; ages tabular
3. Approve/Reject only on human-waiting row
4. Greyscale only (no accent)
5. Dump missing → honest error, no fake P0
6. Screenshot set: human / empty / in-flight / dump-missing

---

## OUT

MCP/board runtime, CA launch from Studio, fleet chrome, glass HUD, Ink Desk costume, 14d clock (unarmed per lock).

## HANDOFF

Artifact dir: `/workspace/rd-os-design/desktop/`  
Cockpit HTML SoT: `/workspace/rd-os-design/waiting-greyscale.html`  
Eng Lead briefs CA when OS/MCP PR allows UI pass.

## Scaffold
See [SCAFFOLD-PLAN.md](./SCAFFOLD-PLAN.md) for CA4 ordered steps.

