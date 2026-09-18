# Connectors — TWO-WAY + HITL (PRODUCT LOCK)

## Law
Connectors are **bidirectional**:
- **Ingest → Studio:** unified **notification inbox** → Chat thread and/or Board **need-you**
- **Out ← Studio:** reply composer bound to that thread; **HITL** before high-risk sends

Tray: auth + live/needs_auth/error + inbox entry — **not read-only**.

## Unified inbox
- One inbox model; surfaces in **Chat** (thread) and **Board** (need-you card) as appropriate  
- Reply **composer bound to active notification/thread**  
- Visibility: need-you + auth failures only ([VISIBILITY.md](./VISIBILITY.md))

## HITL pending card (high-risk outbound)
Before send, show a **pending card** with **payload + diff** (or full text) for human Approve/Deny when risk is:

| High-risk | Examples |
| --- | --- |
| Merge | merge PR, land commit |
| Deploy | Vercel/prod promote |
| DB | migrate, destructive query |
| Public post | public Slack/channel blast, public GitHub comment on sensitive release |

Card must show: destination, actor (human/bot), payload preview, **diff** when code/config, Approve / Deny.  
Bot outbound also requires in-studio-only cutover ([PRODUCT-NARRATIVE](./PRODUCT-NARRATIVE.md)).

Low-risk replies (normal PR comment, 1:1 Slack) may send from composer without HITL card — still bound to thread.

## Provider order
- **P0:** GitHub, Slack (inbox + reply + HITL when high-risk)  
- **Next:** Linear, Sentry, Vercel  

## Eng fences
```
studio/design/**                 # this SoT
studio/connectors/CATALOG.md
shell/.../ConnectorsTray.tsx
panes/ChatPane.tsx               # inbox + bound composer
panes/BoardPane.tsx              # need-you + HITL pending card (payload+diff)
```

## See also
[HITL.md](./HITL.md) — ingress vs egress split, pending-approval card.

