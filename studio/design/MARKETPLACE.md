# Studio Marketplace — SoT

**Job:** Discover → understand → install/connect → manage eng capabilities inside the homebase.  
**Not:** a Grok Bot UI/IA clone · life-OS store · Waiting table · generic agent mall.

## Surface
Dedicated **modal or `/marketplace` route** — opened from tray “+” / Settings / empty cold-open.  
Does **not** replace Chat|Board default chrome.

## Catalog (eng-native)
| Tier | Content | P0 |
| --- | --- | --- |
| **Connectors** | GitHub, Slack, Linear, Sentry, Vercel, … (CATALOG; two-way) | GitHub + Slack first |
| **Modes / rails** | eng, design, … (`studio/modes`) | second |
| **Seat packs** | Lead / Proof / Builder / Designer… + cutover behavior | second |
| Later | Eng-measured skills/recipes (Δ bar) | later |

## Steal from Grok Bot (pattern only)
Browse/search · clear install/connect CTA · installed vs available · one-place manage/revoke.

## Do not copy
Grok visual chrome/layout/copy · lifestyle connectors first-class · toy agent-store vibe.

## IA
1. **Browse** — tabs: Connectors | Modes | Seats · search · filters: Installed / Available  
2. **Detail** — what it does · two-way/HITL notes · install/connect or manage  
3. **Installed** — list with state + Revoke / Re-auth / Configure  

### Connector card anatomy
- Name + one-line eng job  
- State: `available` | `needs_auth` | `live` | `error`  
- Badges: **two-way** (notify+reply) · **HITL tier** (low / high-risk egress)  
- CTA: Connect | Fix auth | Manage  

### Mode card anatomy
- Name · what rail it forces · **falsifier** (how you know it’s working)  
- CTA: Enable | Disable  

### Seat pack card anatomy
- Role name · responsibilities · **cutover** (in-studio-only behavior)  
- CTA: Add seat | Manage  

## Empty / error
- Empty available: “No matches” + clear filters  
- Empty installed: “Nothing installed — connect GitHub or Slack to start”  
- Error: provider error string + Retry / Re-auth  

## Visibility
Marketplace itself is opt-in. Home chrome still only need-you ([VISIBILITY.md](./VISIBILITY.md)).

## Eng fences
```
studio/design/**           # this SoT + marketplace.html
studio/marketplace/**      # later eng impl
studio/connectors/CATALOG.md
studio/modes/
shell: open Marketplace from tray + ; route/modal
```

## Mock
`marketplace.html` — browse connectors, GitHub detail, installed manage.

## Token efficiency
- Browse filter: **low-token** (lean connectors/modes/packs)
- Card badge: cost class `lean` | `normal` | `heavy` when known
- Installed manage: link to seat/Board meter, not a separate billing clone
- See [TOKEN-UX.md](./TOKEN-UX.md)
