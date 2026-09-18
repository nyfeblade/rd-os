# Shell IA + eng fences

## Chrome
```
[Studio] [mode: eng ▾] [GitHub● Cursor● Claude○ … +]     ● 3 here
```
- **Modes** chip/select left of connectors  
- **Connectors tray** — two-way. Default visible states: `live` | `needs_auth` (problems only per [VISIBILITY.md](./VISIBILITY.md)). Click → connect/auth/detail  
- **Notification inbox** — inbound from live connectors (GitHub, Slack P0)  
- Presence right  

## Connectors TWO-WAY (product lock)
Not ingest-only. A live connector:

1. **Ingest** — notifications / threads land in the inbox and can open a Chat thread  
2. **Human reply FROM studio** — composer is **thread-bound** (reply stays on that GitHub/Slack thread; not a free-floating blast)  
3. **Bot send** — seats may send outbound **only with gates** (Board approve / policy); no ungated bot spam  

**P0 two-way:** GitHub + Slack.  
Tray chrome: `live` | `needs_auth` (plus `disconnected` / `error` in detail, not a full catalog on the bar).

## Default body (2 panes)
| Chat | Board |
| current thread + thread-bound composer | gates that need the human now |

## Code drawer (on demand)
- Opens from: top **Code**, Board “open diff”, Chat file/PR cite, shortcut  
- Closes: Close / Esc  
- Contents: repo switcher, tree, preview/diff  
- Does **not** replace Board; squeezes or overlays per platform (prefer split push Chat narrower)

## Eng implement fences (CA)
```
desktop/ or studio/shell/
  chrome/ConnectorsTray.tsx     # live | needs_auth
  chrome/NotificationInbox.tsx # ingest
  chrome/ModesRail.tsx
  chrome/PresenceBar.tsx
  panes/ChatPane.tsx            # thread-bound human reply FROM studio
  panes/BoardPane.tsx
  panes/CodeDrawer.tsx
studio/connectors/CATALOG.md    # catalog SoT (eng)
studio/modes/                   # PR#14
studio/design/                  # this SoT copied in
```
**Do not:** Waiting-as-home; Code always-on; touch board kernel/db/lock unless briefed.

## Acceptance
1. Cold open: Chat|Board only; Code closed  
2. Tray shows `live` | `needs_auth` (P0 GitHub + Slack at minimum; not a full catalog by default)  
3. Notification inbox receives ingest from live connectors  
4. Human reply composer is thread-bound (GitHub issue/PR or Slack thread)  
5. Bot send through a connector requires a Board/policy gate  
6. Code opens/closes without losing Board  
7. Empty chat: connect GitHub / an agent CTA  
