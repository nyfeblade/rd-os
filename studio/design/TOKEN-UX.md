# Token efficiency as product UX (Luke law)

Studio **optimizes token burn in the UI** — eng cost visibility, not a Grok Bot clone meter.

## Principles
1. **Quiet defaults** — hide non-need-you noise ([VISIBILITY.md](./VISIBILITY.md)); fewer automatic agent wakes  
2. **See cost where work is** — token meter on **Board** (run/CA) and **seat** (thread/session), not a vanity dashboard  
3. **Choose cheap paths** — Marketplace **low-token mode** prefers lean connectors/modes/seat packs  

## UI
| Surface | What shows |
| --- | --- |
| Board card / CA row | Est. or rolling tokens for that run (when known) |
| Seat / thread header | Session tokens (optional collapse) |
| Marketplace | Filter/badge: **low-token**; detail: expected cost class (lean / normal / heavy) |
| Defaults | Low-token mode off until user enables; enabling biases catalog + quiet routines |

## Not
- Lifestyle usage graphs  
- Copying Grok Bot billing chrome  
- Hiding cost on heavy seat packs  

## Eng
Expose meters from CA/provider usage when available; unknown → omit (don’t invent).  
Land under `studio/design/**` with MARKETPLACE + PRODUCT-NARRATIVE pointers.
