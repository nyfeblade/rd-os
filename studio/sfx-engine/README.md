# studio/sfx-engine

AI-native **offline DSP** toolchain. Agents call tools to author SFX **systems**. Studio / other apps consume the exported pack later.

Not a Web Audio craft UI. Not a human mixer. Chat-only “make a whoosh” is a fail (`MISSING_GRAPH_IR`).

```bash
node studio/sfx-engine/prove.js
node studio/sfx-engine/prove.js --gate studio/sfx-engine/fixtures/good
node studio/sfx-engine/prove.js --gate studio/sfx-engine/fixtures/planted   # exit 2
```

Node 18+. No npm install. No HTTP. `verdict` stays null. `clock_started` stays false.

## Tool surface

```js
const { createEngine } = require("./studio/sfx-engine");
const sfx = createEngine();

sfx.call("synth.patch", { patch });   // versioned graph IR
sfx.call("synth.render", { patch_id, seed, format: "wav" | "flac" });
sfx.call("sfx.layer", { stems: [{ patch_id, gain, pan, offset_ms }] });
sfx.call("sfx.process", { patch_id, seed, chain: [{ type: "compress" | "eq" | "limiter" | "reverb" | "transient" }] });
sfx.call("sfx.vary", { patch_id, seed, n });
sfx.call("pack.bind", { pack_id, event_id, file, gain, cooldown_ms, reduced_motion_mute, patch });
sfx.call("pack.export", { pack_id, format: "json" | "zip" });
```

Graph IR (`sfx.graph.v1`) is required. Node kinds: `osc` `noise` `env` `filter` `lfo` `fm` `am` `granular` `sample` `mix`. Render is offline and seed-deterministic. Falsifiers on the render report: `too_quiet`, `clipping`, `over_120ms`.

## Pack

Starter: `packs/studio.chrome.v1/pack.json`. Binds every STUDIO-EVENTS id and keeps the patch IR so an agent can regenerate or vary.

```json
{
  "id": "pack.studio.chrome.v1",
  "events": { "ui.send": { "file": "ui_send.wav", "gain": 0.7, "cooldown_ms": 80 } },
  "patches": { "ui.send": { "version": "sfx.graph.v1" } }
}
```

Shell consume (`event → play(asset)`) is later. This lane does not edit `studio/shell`, connectors, seats, design, or desktop.

## Fence

`studio/sfx-engine/**` only.
