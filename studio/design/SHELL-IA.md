# Shell IA + eng fences

## Chrome
```
[Studio] [mode: eng ▾] [GitHub● Cursor● Claude○ … +]     ● 3 here
```
- **Modes** chip/select left of connectors  
- **Connectors tray** — two-way ([CONNECTORS-TWO-WAY.md](./CONNECTORS-TWO-WAY.md)). Default: `live` | `needs_auth`. Click → connect/auth/error + **inbox filter**. Not display-only  
- **Inbox** — inbound need-you items in Chat (threaded) and/or Board  
- Presence right  

## Connectors TWO-WAY (product lock)
Not ingest-only. See [CONNECTORS-TWO-WAY.md](./CONNECTORS-TWO-WAY.md).

| In → Studio | Out ← Studio |
| --- | --- |
| Notifications / events into Chat and/or Board (need-you) | Human reply from bound composer; bot send only with **cutover + human gate** |

1. **Inbox** — Chat thread (preferred) and/or Board need-you card  
2. **Reply composer** — same Chat composer, **bound to the active notification/thread**  
3. **Bot outbound** — in-studio-only cutover **and** Board Approve/confirm — no silent spam  
4. **Tray** — `live` | `needs_auth` by default; connect/error + inbox entry  

**P0:** GitHub + Slack.  
High-risk egress: [HITL.md](./HITL.md) pending-approval card (payload + diff) before send.

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
studio/design/CONNECTORS-TWO-WAY.md
studio/modes/                   # PR#14
studio/design/                  # this SoT copied in
```
**Do not:** Waiting-as-home; Code always-on; touch board kernel/db/lock unless briefed.

## Acceptance
1. Cold open: Chat|Board only; Code closed  
2. Tray shows `live` | `needs_auth` (P0 GitHub + Slack at minimum; not a full catalog by default)  
3. Notification inbox receives ingest from live connectors  
4. Human reply composer is thread-bound (GitHub issue/PR or Slack thread)  
5. Bot send requires in-studio-only cutover **and** a Board human gate  
6. Code opens/closes without losing Board  
7. Empty chat: connect GitHub / an agent CTA  
