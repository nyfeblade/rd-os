#!/usr/bin/env node
"use strict";

/**
 * Stranger-reproducible sfx-engine prove script.
 *
 *   node studio/sfx-engine/prove.js
 *     Library checks + good/planted fixtures through createEngine().call.
 *     Exit 0 only if every expect block matches.
 *
 *   node studio/sfx-engine/prove.js --gate <dir-or-file>
 *     Exit 0 if every fixture evaluates ok=true, exit 2 if any reject.
 *     Planted fixtures are expected to bite.
 *
 * Node 18+. No npm install. No Web Audio. Does not write a verdict. Does not arm the clock.
 */

const fs = require("fs");
const path = require("path");

const engineLib = require("./index");

const root = path.resolve(__dirname, "..", "..");
const HERE = __dirname;
const FIXTURES = path.join(HERE, "fixtures");

let passed = 0;
let failed = 0;

function pass(name) {
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function fail(name, detail) {
  failed += 1;
  process.stderr.write(`FAIL ${name}: ${detail}\n`);
}

function rel(abs) {
  return path.relative(root, abs) || abs;
}

function listRecords(target) {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) throw new Error(`no such fixture path: ${target}`);
  if (fs.statSync(abs).isFile()) return [abs];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.join(abs, entry.name);
    if (entry.isDirectory()) out.push(...listRecords(child));
    else if (entry.name.endsWith(".json")) out.push(child);
  }
  return out;
}

function extraKeys(object, allowed) {
  if (!object || typeof object !== "object") return ["<missing>"];
  return Object.keys(object).filter((key) => !allowed.includes(key)).sort();
}

function missingKeys(object, required) {
  if (!object || typeof object !== "object") return required.slice();
  return required.filter((key) => !Object.prototype.hasOwnProperty.call(object, key));
}

function evaluateFixture(record, engine) {
  const steps = Array.isArray(record.setup) ? record.setup : [];
  for (const step of steps) {
    const prior = engine.call(step.tool, step.payload || {});
    if (!prior.ok) return prior;
    if (step.save_asset_as && record.payload && prior.asset_id) {
      record.payload.asset_id = prior.asset_id;
    }
    if (step.save_patch_as && record.payload && prior.patch_id) {
      record.payload.patch_id = prior.patch_id;
    }
  }
  return engine.call(record.tool, record.payload || {});
}

function uniqueClosed(name, list) {
  const seen = new Set();
  for (const code of list) {
    if (seen.has(code)) fail(name, `duplicate ${code}`);
    seen.add(code);
  }
  if (seen.size === list.length) pass(`closed ${name} (${list.length})`);
}

function walkEngineJs() {
  const out = [path.join(HERE, "index.js")];
  const lib = path.join(HERE, "lib");
  for (const entry of fs.readdirSync(lib).sort()) {
    if (entry.endsWith(".js")) out.push(path.join(lib, entry));
  }
  return out;
}

function checkLibrary() {
  uniqueClosed("TOOLS", engineLib.TOOLS);
  uniqueClosed("CODES", engineLib.CODES);
  uniqueClosed("NODE_KINDS", engineLib.NODE_KINDS);
  uniqueClosed("STUDIO_EVENTS", engineLib.STUDIO_EVENTS);
  uniqueClosed("REPORT_FIELDS", engineLib.REPORT_FIELDS);

  const requiredKinds = ["osc", "noise", "env", "filter", "lfo", "fm", "granular", "sample"];
  const missingKinds = requiredKinds.filter((kind) => !engineLib.NODE_KINDS.includes(kind));
  if (missingKinds.length) fail("node kinds", `missing ${missingKinds.join(",")}`);
  else pass(`graph IR kinds include ${requiredKinds.join(",")}`);

  const catalog = engineLib.loadEventsCatalog();
  const catalogIds = catalog.events.map((row) => row.id);
  const same =
    catalogIds.length === engineLib.STUDIO_EVENTS.length &&
    catalogIds.every((id, i) => id === engineLib.STUDIO_EVENTS[i]);
  if (!same) fail("events catalog", JSON.stringify(catalogIds));
  else pass("events.json matches STUDIO-EVENTS ids");

  const banned = ["Audio" + "Context", "webkit" + "Audio" + "Context", "Offline" + "Audio" + "Context", "new Audio" + "("];
  let audioLeak = false;
  for (const file of walkEngineJs()) {
    const text = fs.readFileSync(file, "utf8");
    for (const token of banned) {
      if (text.includes(token)) {
        fail("no web audio", `${rel(file)} contains ${token}`);
        audioLeak = true;
      }
    }
  }
  if (!audioLeak) pass("no Web Audio authoring dependency");

  const engine = engineLib.createEngine();
  const pinned = engine.call("synth.patch", {
    patch: {
      version: engineLib.IR_VERSION,
      id: "pin",
      duration_ms: 40,
      nodes: { osc: { type: "osc", wave: "sine", hz: 440, gain: 0.2 }, out: { type: "env", input: "osc", attack_ms: 2, decay_ms: 20, sustain: 0, release_ms: 8 } },
      out: "out",
    },
  });
  if (pinned.verdict !== null || pinned.clock_started !== false) {
    fail("report pins", JSON.stringify({ verdict: pinned.verdict, clock_started: pinned.clock_started }));
  } else {
    pass("report keeps verdict=null and clock_started=false");
  }

  const chat = engine.call("synth.patch", { prompt: "make a whoosh", description: "airy UI whoosh" });
  if (!chat.ok && chat.code === "MISSING_GRAPH_IR") pass("chat-only whoosh is refused (no graph IR)");
  else fail("chat-only whoosh", JSON.stringify({ ok: chat.ok, code: chat.code }));

  const whoosh = engineLib.loadStarterPackJson().patches["ui.code_open"];
  const a = engine.call("synth.render", { patch: whoosh, seed: 7 });
  const b = engine.call("synth.render", { patch: whoosh, seed: 7 });
  const c = engine.call("synth.render", { patch: whoosh, seed: 8 });
  if (!a.ok || !b.ok || !c.ok) fail("seed render", `${a.code || ""} ${c.code || ""}`);
  else if (a.sha256 !== b.sha256) fail("seed render", "same seed produced different bytes");
  else if (a.sha256 === c.sha256) fail("seed render", "different seeds produced identical bytes");
  else pass("synth.render is seed-deterministic");

  const flac = engine.call("synth.render", { patch: whoosh, seed: 3, format: "flac" });
  const flacBytes = engine.getAudio(flac.asset_id);
  if (!flac.ok || !flacBytes || flacBytes.subarray(0, 4).toString() !== "fLaC") {
    fail("flac", flac.detail || "missing fLaC header");
  } else {
    pass("synth.render format=flac writes a FLAC container");
  }

  const quiet = engine.call("synth.render", {
    seed: 1,
    patch: {
      id: "too-quiet",
      duration_ms: 40,
      nodes: { osc: { type: "osc", wave: "sine", hz: 440, gain: 0 }, out: { type: "env", input: "osc", attack_ms: 1, decay_ms: 10, sustain: 0, release_ms: 5 } },
      out: "out",
    },
  });
  const clip = engine.call("synth.render", {
    seed: 1,
    patch: {
      id: "clip",
      duration_ms: 40,
      nodes: { osc: { type: "osc", wave: "sine", hz: 440, gain: 2 }, out: { type: "mix", inputs: ["osc"], gains: [1] } },
      out: "out",
    },
  });
  const long = engine.call("synth.render", {
    seed: 1,
    patch: {
      id: "long",
      duration_ms: 200,
      nodes: { osc: { type: "osc", wave: "sine", hz: 440, gain: 0.3 }, out: { type: "env", input: "osc", attack_ms: 5, decay_ms: 80, sustain: 0.2, release_ms: 20 } },
      out: "out",
    },
  });
  if (!quiet.falsifiers || !quiet.falsifiers.includes("too_quiet")) fail("falsifier", "too_quiet did not fire");
  else pass("falsifier too_quiet");
  if (!clip.falsifiers || !clip.falsifiers.includes("clipping")) fail("falsifier", "clipping did not fire");
  else pass("falsifier clipping");
  if (!long.falsifiers || !long.falsifiers.includes("over_120ms")) fail("falsifier", "over_120ms did not fire");
  else pass("falsifier over_120ms");

  const starter = engine.loadStarter();
  if (!starter.ok) fail("starter pack", starter.detail || starter.code);
  else {
    const missing = engine.missingStudioEvents(starter.pack_id);
    if (missing.length) fail("starter pack", `unbound ${missing.join(",")}`);
    else pass(`starter pack binds all STUDIO-EVENTS (${engineLib.STUDIO_EVENTS.length})`);
  }

  const exported = engine.call("pack.export", { pack_id: "pack.studio.chrome.v1", format: "json" });
  const zip = engine.call("pack.export", { pack_id: "pack.studio.chrome.v1", format: "zip" });
  const packEvents = exported.pack && exported.pack.events ? Object.keys(exported.pack.events).sort() : [];
  const packPatches = exported.pack && exported.pack.patches ? Object.keys(exported.pack.patches).sort() : [];
  const expected = engineLib.STUDIO_EVENTS.slice().sort();
  if (!exported.ok || packEvents.join() !== expected.join() || packPatches.join() !== expected.join()) {
    fail("pack.export json", JSON.stringify({ events: packEvents, patches: packPatches }));
  } else {
    pass("pack.export json keeps files + graph IR for every studio event");
  }
  if (!zip.ok || zip.bytes < 100 || !zip.files || !zip.files.includes("pack.json")) {
    fail("pack.export zip", zip.detail || JSON.stringify(zip.files));
  } else {
    pass("pack.export zip includes pack.json + rendered assets");
  }
}

function matchExpect(result, expect) {
  if (result.ok !== expect.ok) {
    return `expected ok=${expect.ok}, got ok=${result.ok} code=${result.code || "none"} detail=${result.detail || ""}`;
  }
  if (expect.ok === false) {
    if (expect.code && result.code !== expect.code) {
      return `expected code=${expect.code}, got ${result.code}`;
    }
    return null;
  }
  if (expect.tool && result.tool !== expect.tool) {
    return `expected tool=${expect.tool}, got ${result.tool}`;
  }
  if (expect.format && result.format !== expect.format) {
    return `expected format=${expect.format}, got ${result.format}`;
  }
  if (typeof expect.n === "number" && result.n !== expect.n) {
    return `expected n=${expect.n}, got ${result.n}`;
  }
  if (expect.has_ir && !result.ir) return "expected graph IR on the report";
  if (expect.has_sha && !result.sha256) return "expected sha256 on the report";
  return null;
}

function checkFixtures() {
  const files = listRecords(FIXTURES);
  if (files.length === 0) fail("fixtures", "none found");

  let good = 0;
  let planted = 0;

  for (const file of files) {
    const name = rel(file);
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    const expect = record.expect;
    if (!expect || typeof expect.ok !== "boolean") {
      fail(name, "fixture has no expect.ok block");
      continue;
    }

    let result;
    try {
      result = evaluateFixture(record, engineLib.createEngine());
    } catch (err) {
      fail(name, `evaluate threw: ${err.message}`);
      continue;
    }

    if (result.verdict !== null || result.clock_started !== false) {
      fail(name, `pins drifted: verdict=${JSON.stringify(result.verdict)} clock_started=${result.clock_started}`);
      continue;
    }

    const reportExtra = extraKeys(result, engineLib.REPORT_FIELDS);
    const reportMissing = missingKeys(result, engineLib.REPORT_FIELDS);
    if (reportExtra.length || reportMissing.length) {
      fail(name, `report fields extra=${reportExtra.join(",")} missing=${reportMissing.join(",")}`);
      continue;
    }

    const mismatch = matchExpect(result, expect);
    if (mismatch) {
      fail(name, mismatch);
      continue;
    }

    if (expect.ok) {
      good += 1;
      pass(`${name} ${result.tool}`);
    } else {
      planted += 1;
      pass(`${name} trips ${result.code}`);
    }
  }

  if (good === 0) fail("fixtures", "no good fixtures; toolchain could be rejecting everything");
  if (planted === 0) fail("fixtures", "no planted fixtures; toolchain could be accepting everything");

  const plantedDir = path.join(FIXTURES, "planted");
  const anyClean = listRecords(plantedDir).some((file) => {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    return evaluateFixture(record, engineLib.createEngine()).ok;
  });
  if (anyClean) fail("gate", "a planted record cleared the toolchain");
  else pass("every planted record is caught");

  const plantedCodes = new Set();
  for (const file of listRecords(plantedDir)) {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    if (record.expect && record.expect.code) plantedCodes.add(record.expect.code);
  }
  const missing = engineLib.CODES.filter((code) => !plantedCodes.has(code));
  if (missing.length) fail("planted coverage", `no fixture for ${missing.join(",")}`);
  else pass(`planted fixtures cover every sfx-engine code (${engineLib.CODES.join(",")})`);
}

function gate(target) {
  const files = listRecords(target);
  let dirty = 0;
  for (const file of files) {
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    const result = evaluateFixture(record, engineLib.createEngine());
    if (result.ok) {
      process.stdout.write(`OK   ${rel(file)}\n`);
      continue;
    }
    dirty += 1;
    process.stderr.write(`CODE ${rel(file)} ${result.code}: ${result.detail}\n`);
  }
  process.stdout.write(
    `sfx-engine gate: ${files.length - dirty}/${files.length} ok; verdict=null; clock_started=false\n`
  );
  process.exit(dirty ? 2 : 0);
}

function main() {
  const argv = process.argv.slice(2);
  const gateAt = argv.indexOf("--gate");
  if (gateAt !== -1) {
    const target = argv[gateAt + 1];
    if (!target) {
      process.stderr.write("--gate needs a file or directory\n");
      process.exit(2);
    }
    gate(target);
    return;
  }

  checkLibrary();
  checkFixtures();
  process.stdout.write(
    `sfx-engine ${passed} passed, ${failed} failed; verdict=null; clock_started=false; not a 14d verdict\n`
  );
  process.exit(failed ? 1 : 0);
}

try {
  main();
} catch (err) {
  process.stderr.write(`ERROR ${err.message}\n`);
  process.exit(1);
}
