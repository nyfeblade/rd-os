# AI Coding Studio — product narrative (Luke law)

## North star
**Homebase for ANY AI developer** — a daily driver, not a Luke-fleet-only ops panel.  
Stranger cold-open must work. Multi-provider (not Cursor-only). Eng-optimized Grok Bot capability set.

## Who it’s for
- Solo AI-assisted developers and small teams  
- People using agents / CloudAgents / Copilot-class tools across providers  
- Not: internal-only control surface for one studio’s bot roster  

## Product law
Studio = **Grok Bot capability set, OPTIMIZED FOR ENGINEERING** — bent toward any AI developer’s day, not one fleet’s org chart.

## Capability → eng surface map

| Grok Bot capability | Studio eng surface |
| --- | --- |
| **Seats** (agents) | Seat list in Chat; optional **in-studio-only** while connected |
| **Rooms** | Rooms in Chat — project/coord threads |
| **1:1 chat** | Chat pane (default) |
| **Routines** | **Board watches** — scheduled/event checks as board rows/chips |
| **Skills / modes** | **Eng modes** — Build, Proof, Review… (provider-agnostic presets) |
| **Memory** | Project / seat memory — detail or Settings (not a home column) |
| **Connectors** | Connectors tray — GitHub, agents/CA, Notion, … **multi-provider** |
| **Cloud Agents / coding agents** | **Agent map** — who’s running, where (repo/PR); not one-vendor locked |
| **Proof / human gates** | **Board** — P0, gates, Approve/Reject |
| **Desktop / files** | **Code on demand** ([LAYOUT-LOCK.md](./LAYOUT-LOCK.md)) |

## Cold open (stranger)
1. Lands on **Chat | Board** — understands “talk to agents” + “what’s blocked on me” in ≤30s  
2. No fleet jargon required (Eng Lead / Proof as *examples*, not mandatory taxonomy)  
3. Connectors empty-state: “Connect GitHub / an agent provider” — not a brick wall  
4. Code closed until asked  

## Layout lock (holds)
- **Default:** Chat \| Board  
- **Code:** on demand only  
- Waiting-table-as-home: **DEAD**  
- Not a fleet-only status wall  

## Story
The AI developer’s homebase: chat with agents, clear gates, open code when a diff matters — any provider, every day.

## Land in repo
Design CA: `studio/design/**`  
Local SoT: this folder (`PRODUCT-NARRATIVE.md`, `LAYOUT-LOCK.md`, `quiet-studio.html`, `STUDIO-SHELL-SPEC.md`, `tokens.css`)

## Out
Fleet-only chrome; Mac-only; Code always-on; Waiting-as-home; single-provider lock-in; Design launching CAs.
