# AI Coding Studio — product narrative + UI coverage

## North star
**Homebase for ANY AI developer** — daily driver, stranger cold-open, multi-provider.  
Eng-optimized **Grok Bot capability set** (every power → eng surface, not a thinner chat clone).

## Layout locks (do not violate)
- Default: **Chat | Board** always visible  
- **Code on demand** only (drawer/panel — not always-on third column)  
- Waiting-table-as-home: **DEAD**  
- Desktop **Mac + Windows**, immersive dark tool aesthetic  
- Hard cutover: connected seats show **in-studio-only**  

## Capability → eng surface

| Grok power | Eng surface |
| --- | --- |
| Seats | Chat seat list (Grok / Claude / Cursor / human / roles) + presence + in-studio-only |
| Rooms | Chat rooms tied to missions/PRs (bot↔bot here) |
| Chat | Chat pane — thread + composer + multi-seat @ |
| Routines | Board **watches** (Actions, Sentry, Linear, deploy…) |
| Skills | **Modes** chips / rails (eng, design…) — research-before-claim, lane fences, no self-cert |
| Memory | Seat/project memory in detail or Settings |
| Connectors | **Two-way** tray + inbox — ingest, human reply FROM studio (thread-bound), bot send **with gates** |
| Cloud Agents | **CA/builder map** on Board (+ tray entry) |
| Proof / gates | Board — P0, Approve/Reject, human-only actions obvious |
| Desktop/files | **Code drawer** on demand |

## Connectors TWO-WAY (product lock)
Not a one-way ingest tray. Live connector = inbox + reply + gated bot send.

- **Tray chrome (default):** `live` | `needs_auth` — show problems, not the full catalog ([VISIBILITY.md](./VISIBILITY.md))  
- **Notification inbox:** inbound events/threads from live connectors  
- **Human reply FROM studio:** composer is **thread-bound** (that GitHub PR/issue or Slack thread)  
- **Bot send:** seats may post outbound only **with gates** (Board / policy)  
- **P0 two-way:** **GitHub + Slack**  
- Other providers (Cursor/CA, Claude, Grok, Linear, Sentry, Vercel, …) stay in the catalog; detail states include `disconnected` | `error`  
- Catalog SoT (eng): `studio/connectors/CATALOG.md`  
- Designer drop `CONNECTORS-TWO-WAY` / mock updates land here when received  

## Modes / rails
Visible mode chips (eng / design / …). Align with `studio/modes` (PR#14). Encode: research-before-claim, lane fences, no self-cert.

## Cold open (stranger)
1. Chat | Board readable in ≤30s without fleet lore  
2. Empty: “Connect a seat to start” + connect GitHub  
3. Onboarding path: GitHub + one AI seat + see Board  
4. Multi-provider first-class (not Grok-only chrome)  

## Out of UI scope
Life-OS, food, flights, Mac-only, Waiting-as-home, Code always-on, Design launching CAs.

## Artifacts
| File | Role |
| --- | --- |
| `PRODUCT-NARRATIVE.md` | This coverage brief |
| `LAYOUT-LOCK.md` | Code on demand |
| `SHELL-IA.md` | Pane/tray/drawer IA + fences |
| `quiet-studio.html` | Mock: Chat\|Board + tray + Code drawer |
| `tokens.css` | Tokens |
| Land | `studio/design/**` via Design CA |
