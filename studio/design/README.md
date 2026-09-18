# AI Coding Studio — design SoT

**North star:** homebase for **any** AI developer — not Luke-fleet-only. See `PRODUCT-NARRATIVE.md`.  
**Luke law:** eng-specialized Grok Bot (full capability set); multi-provider seats.  
**Layout:** Chat | Board default · Code on demand (drawer) · Waiting-home dead. See `LAYOUT-LOCK.md`.  
**Visibility:** only necessary info by default. See `VISIBILITY.md`.  
**Chrome fences:** `SHELL-IA.md` is authoritative (two-way tray + Code drawer).  
**Connectors:** two-way — inbox + outbound reply. Tray `live` \| `needs_auth`. P0: GitHub + Slack. See `CONNECTORS-TWO-WAY.md`.  
**HITL:** ingress inbox vs egress composer | pending-approval (payload+diff). See `HITL.md`.

| File | Use |
| --- | --- |
| `PRODUCT-NARRATIVE.md` | UI coverage + Grok Bot → Studio map |
| `CONNECTORS-TWO-WAY.md` | Two-way + HITL pending card (payload+diff) before high-risk send |
| `HITL.md` | Ingress inbox vs egress composer \| pending-approval fields |
| `CONNECTORS-TWOWAY.md` | Pointer only — superseded by `CONNECTORS-TWO-WAY.md` |
| `SHELL-IA.md` | Chrome IA — tray, inbox, Code drawer fences |
| `PRODUCT-LAW.md` | Grok-complete lock; no life-OS theater |
| `VISIBILITY.md` | Only necessary info visible by default |
| `LAYOUT-LOCK.md` | Code not automatic |
| `STUDIO-SHELL-SPEC.md` | Prior shell spec (kept); defer chrome to `SHELL-IA.md` |
| `quiet-studio.html` | Inbox thread + bound composer; Board HITL card (payload+diff) |
| `three-pane.html` | Denser wire — **superseded** for Code-always-on |
| `tokens.css` | Dark quiet tokens |

Feed CA lanes fencing `studio/shell|seats|github`. Desktop Mac+Win.
