# Connectors — TWO-WAY (PRODUCT LOCK)

## Law
Connectors are **bidirectional**:
- **Ingest → Studio:** notifications/events into **Chat** and/or **Board** (need-you)
- **Out ← Studio:** human replies from Studio composer; **bots** may send only with **cutover + human gate** on send

Tray is **not read-only** — auth, live state, inbox entry, send path.

## P0
| Connector | In | Out |
| --- | --- | --- |
| **GitHub** | PR/issue comments, review requests, CI@you | Comment / review reply from Studio |
| **Slack** | Eng channel/DM @mentions | Message reply from Studio |

## UI binding
- **Notification inbox:** thread in Chat (preferred) and/or Board card if it needs a gate  
- **Reply composer:** same Chat composer, **bound to the active notification/thread** (not a free-floating global outbox)  
- **Tray states:** `live` | `needs_auth` | `error` | `disconnected`  
- Visibility: show need-you notifications + auth failures; hide idle catalog ([VISIBILITY.md](./VISIBILITY.md))

## Bot outbound
Bot send via connector requires:
1. Seat **in-studio-only** cutover active  
2. **Human gate** on that send (Approve on Board or explicit confirm) — no silent bot spam out

## Layout locks (unchanged)
Chat | Board default · Code on demand · Waiting-home dead

## Eng fences
```
studio/connectors/CATALOG.md
studio/design/**                    # this SoT
shell/chrome/ConnectorsTray.tsx     # live|needs_auth + inbox
panes/ChatPane.tsx                  # inbox thread + bound reply composer
panes/BoardPane.tsx                 # need-you + human gate for bot send
```
