# studio/chrome-craft

Consume-only Studio chrome: **motion helpers + event SFX player**.

Not authoring. Not a mixer. `studio/sfx-engine` owns DSP / pack.bind / pack.export. This lane loads the exported pack and plays it.

## Fence

WRITE:

- `studio/chrome-craft/**` — player, motion, pack loader, smoke, this README
- `studio/craft/packs/studio-chrome-v1/**` — `pack.json` + placeholder wavs

DO NOT TOUCH:

- `studio/shell/**` (PR#11 — shell A owns it; this module is imported later)
- `studio/sfx-engine/**`
- `studio/connectors/**`, `studio/design/**`, `desktop/**`, `src/**`

## Visual lock

White / slate / black. Ultra-minimal. No glass, no accent theater, no bounce.

| Token | Value | Use |
| --- | --- | --- |
| `white` / `bg` | `#ffffff` | app ground |
| `slate` | `#64748b` | mute / secondary |
| `ink` | `#111111` | primary type |
| `black` | `#000000` | send / on-state |
| `line` | `#e2e8f0` | hairline rules |

```js
const { VISUAL_LOCK } = require("../chrome-craft");
```

## Public API (shell import after PR#11)

```js
const {
  play,
  createPlayer,
  setMuted,
  motion,
  VISUAL_LOCK,
} = require("../chrome-craft");

play("ui.send");
play("ui.need_you", { need_you: true });
play("ui.need_you", { need_you: false }); // quiet no-op

setMuted(true);

const drawer = motion.codeDrawer();          // ≤180ms ease; 0ms if reduced-motion
const row = motion.needYouExpand();          // ≤100ms (80ms); 0ms if reduced-motion
el.style.transition = drawer.transition;
```

`play(eventId)` never throws. Missing pack, missing wav, unknown id, mute, cooldown, or `need_you=false` → `{ ok: true, played: false }`.

| Event | When (shell) |
| --- | --- |
| `ui.send` | Chat send / outbound reply |
| `ui.need_you` | `need_you` becomes **true** |
| `ui.approve` | Gate Approve |
| `ui.deny` | Gate Deny |
| `ui.connect_ok` | Connector → live |
| `ui.error` | Connector error / send fail |
| `ui.code_open` | Code drawer opens |
| `ui.expand` | Need-you row expands |
| `ui.craft_gen_done` | Pack render finished |

## Quiet

- `need_you=false` does not play `ui.need_you` or `ui.expand`
- User mute: `setMuted(true)` or `play(id, { muted: true })`
- `prefers-reduced-motion`: **default mute**. Opt in with `createPlayer({ sfxDespiteReducedMotion: true })`. Events with `reduced_motion_mute: true` (`ui.code_open`, `ui.expand`) stay silent
- Per-event `cooldown_ms` from the pack (no spam)

## Motion

| Surface | Duration | Easing |
| --- | --- | --- |
| Code drawer open/close | 180ms (max 180) | `ease`, no bounce |
| Need-you row expand | 80ms (max 100) | `ease`, no bounce |
| `prefers-reduced-motion` | **0ms instant** | `transition: none` |

## Pack

`studio/craft/packs/studio-chrome-v1/`

```json
{
  "id": "pack.studio.chrome.v1",
  "events": {
    "ui.send": { "file": "ui_send.wav", "gain": 0.7, "cooldown_ms": 80 }
  },
  "patches": {}
}
```

Placeholder wavs from STUDIO-EVENTS. Graph IR stays in `studio/sfx-engine` — this pack is files for a dumb player.

Default load path: `../craft/packs/studio-chrome-v1`. Browser later: `createPlayer({ packUrl: "/packs/studio-chrome-v1/" })`.

## How shell consumes after PR#11

1. Land PR#11 (`studio/shell/**`) without waiting on this tree
2. `require` / `import` **this module** — do not copy player code into shell
3. On real chrome events call `play(eventId)`
4. Apply `motion.codeDrawer()` / `motion.needYouExpand()` to drawer + need-you row
5. Wire a user mute control to `setMuted`
6. Honor `prefers-reduced-motion` (helpers already return 0ms + default SFX mute)

This PR does not import from shell and does not change shell.

## Smoke

```bash
cd studio/chrome-craft && npm test
# or
node studio/chrome-craft/smoke.js
```

Expect exit 0. `play()` each listed event with missing files must not throw.

Node 18+. No npm install. Not a 14-day PASS.
