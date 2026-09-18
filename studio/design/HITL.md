# HITL — ingress vs egress (SoT)

Design CA copies to `studio/design/**`.

## Split

| | **Ingress** (into Studio) | **Egress** (out of Studio) |
| --- | --- | --- |
| What | Notifications / events from connectors | Writes Studio → provider |
| UI | **Unified inbox** → Chat thread and/or Board **need-you** | **Reply composer** (low-risk) or **Pending-approval card** (high-risk) |
| Human role | Read / triage / open thread | Approve·Deny sensitive send; compose normal replies |
| Bot role | May surface into inbox | May egress only if in-studio-only **and** HITL Approve on high-risk |

## Ingress — inbox UI
- One inbox model; show only items that need attention ([VISIBILITY.md](./VISIBILITY.md))  
- Opening an item focuses Chat thread **bound** for reply  
- Auth failures stay as tray/`needs_auth` (not inbox spam)

## Egress — two paths
1. **Low-risk reply** — composer on bound thread → send (GitHub comment, Slack 1:1/thread reply)  
2. **High-risk write** — **Pending-approval** card on Board (and optional Chat pin) **before** send:

### Pending-approval card (required fields)
- Kind: merge | deploy | DB | public_post | …  
- Destination (repo/channel/env)  
- Actor: human | bot (+ seat id if bot)  
- **Payload** preview (full text or structured fields)  
- **Diff** when code/config changes  
- Actions: **Approve send** | **Deny**  

High-risk includes: merge, deploy, DB mutate, public post/blast.  
See also [CONNECTORS-TWO-WAY.md](./CONNECTORS-TWO-WAY.md).

## P0 / next
- P0 ingress+egress: GitHub, Slack  
- Next: Linear, Sentry, Vercel (same HITL pattern)

## Mock
`quiet-studio.html` — inbox thread + bound composer (ingress/low-risk egress); Board HITL card with payload+diff (high-risk egress).

## Layout locks
Chat | Board default · Code on demand · Waiting-home dead.
