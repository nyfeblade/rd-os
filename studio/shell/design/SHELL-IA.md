# Shell IA + eng fences

## Chrome
```
[Studio] [mode: eng ▾] [GitHub● Cursor● Claude○ … +]     ● 3 here
```
- **Modes** chip/select left of connectors  
- **Connectors tray** — icons/pills with state color; click → connect/auth/detail  
- Presence right  

## Default body (2 panes)
| Chat | Board |
| seats + rooms + thread + composer | gates + CA map + watches + Approve/Reject |

## Code drawer (on demand)
- Opens from: top **Code**, Board “open diff”, Chat file/PR cite, shortcut  
- Closes: Close / Esc  
- Contents: repo switcher, tree, preview/diff  
- Does **not** replace Board; squeezes or overlays per platform (prefer split push Chat narrower)

## Eng implement fences (CA)
```
desktop/ or studio/shell/
  chrome/ConnectorsTray.tsx
  chrome/ModesRail.tsx
  chrome/PresenceBar.tsx
  panes/ChatPane.tsx
  panes/BoardPane.tsx
  panes/CodeDrawer.tsx
studio/connectors/CATALOG.md    # catalog SoT (eng)
studio/modes/                   # PR#14
studio/design/                  # this SoT copied in
```
**Do not:** Waiting-as-home; Code always-on; touch board kernel/db/lock unless briefed.

## Acceptance
1. Cold open: Chat|Board only; Code closed  
2. Tray shows ≥P0 connectors with state  
3. Mode chip visible  
4. Seat with in-studio-only + presence  
5. Board: human gate actions obvious; CA map row/section  
6. Code opens/closes without losing Board  
7. Empty chat: connect-a-seat CTA  
