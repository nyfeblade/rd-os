# Connectors — two-way (Luke lock)

Connectors are **not read-only status**.

## Direction
| In → Studio | Out → provider |
| --- | --- |
| Notifications / events (PR review, @mention, CI, Slack ping…) | Human or bot **replies** from Studio (comment, Slack message, …) |

## UI
- **Inbox** — notifications land in **Chat** (threaded with seat/room when possible) and/or **Board** as items that need you  
- **Reply composer** — same Chat composer (or inline on Board card) sends **out** via connector  
- **Tray** — connect/auth/live/error **and** entry to inbox filters; not display-only  

## Visibility (with VISIBILITY.md)
Show by default: notifications that **need you** (and connector auth failures).  
Hide: noise, connected-idle catalog, disconnected P1 until opened.

## P0
1. **GitHub** — PR/issue comments, review requests → inbox; reply = comment/review from Studio  
2. **Slack** — eng channel/DM mentions → inbox; reply = message out  

P1+ unchanged in CATALOG; same two-way pattern when enabled.

## Eng fences
```
studio/connectors/CATALOG.md
desktop|studio/shell/chrome/ConnectorsTray.tsx  # auth + inbox entry
panes/ChatPane.tsx                               # inbox threads + outbound composer
panes/BoardPane.tsx                              # need-you notification cards (optional mirror)
```
Land design copy under `studio/design/**`.
