# Shell IA + eng fences

## Chrome
```
[Studio] [mode: eng ▾] [GitHub● Cursor● Claude○ … +]     ● 3 here
```
- **Modes** chip/select left of connectors  
- **Connectors tray** — two-way ([CONNECTORS-TWOWAY.md](./CONNECTORS-TWOWAY.md)). Default: `live` | `needs_auth`. Click → connect/auth/error + **inbox filter**. Not display-only  
- **Inbox** — inbound need-you items in Chat (threaded) and/or Board  
- Presence right  

## Connectors TWO-WAY (product lock)
Not ingest-only. See [CONNECTORS-TWOWAY.md](./CONNECTORS-TWOWAY.md).

| In → Studio | Out → provider |
| --- | --- |
| Notifications / events (PR review, @mention, CI, Slack ping…) | Human or bot **replies** from Studio |

1. **Inbox** — Chat thread (seat/room when possible) and/or Board need-you card  
2. **Reply composer** — same Chat composer (or inline Board); **thread-bound** outbound  
3. **Bot send** — outbound **only with gates** (Board / policy)  
4. **Tray** — `live` | `needs_auth` by default; connect/error + inbox entry in detail  

**P0:** GitHub + Slack.

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
studio/design/CONNECTORS-TWOWAY.md
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
