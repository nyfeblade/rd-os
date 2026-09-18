#!/usr/bin/env node
"use strict";

/**
 * chrome-craft smoke. Node 18+. No npm install.
 *
 *   npm test
 *   node studio/chrome-craft/smoke.js
 *
 * play() each STUDIO-EVENTS id with missing files must not throw.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const chrome = require("./index");

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

function assert(name, cond, detail) {
  if (cond) pass(name);
  else fail(name, detail || "assertion failed");
}

function emptyPackDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-chrome-missing-"));
  const events = {};
  for (const id of chrome.EVENT_IDS) {
    events[id] = {
      file: `${id.replace(/\./g, "_")}.wav`,
      gain: 0.5,
      cooldown_ms: 80,
      reduced_motion_mute: false,
    };
  }
  fs.writeFileSync(
    path.join(dir, "pack.json"),
    `${JSON.stringify({ id: chrome.PACK_ID, events, patches: {} }, null, 2)}\n`,
    "utf8"
  );
  return dir;
}

function hitsPlayer(extra) {
  const hits = [];
  const player = chrome.createPlayer(
    Object.assign(
      {
        prefersReducedMotion: false,
        playAsset(src, gain) {
          hits.push({ src, gain });
        },
      },
      extra || {}
    )
  );
  return { player, hits };
}

function main() {
  const missingDir = emptyPackDir();
  const missingPlayer = chrome.createPlayer({
    packDir: missingDir,
    prefersReducedMotion: false,
    playAsset() {
      throw new Error("missing-file playAsset must not run");
    },
  });

  for (const id of chrome.EVENT_IDS) {
    let result;
    try {
      result = missingPlayer.play(id);
    } catch (err) {
      fail(`play missing ${id} threw`, err && err.message ? err.message : String(err));
      continue;
    }
    assert(
      `play missing ${id} no-op`,
      result && result.ok === true && result.played === false && result.reason === "missing",
      JSON.stringify(result)
    );
  }

  try {
    const ghost = chrome.createPlayer({
      packDir: path.join(os.tmpdir(), "studio-chrome-no-such-pack"),
      prefersReducedMotion: false,
    });
    const result = ghost.play("ui.send");
    assert(
      "play without pack.json no-op",
      result && result.ok === true && result.played === false,
      JSON.stringify(result)
    );
  } catch (err) {
    fail("play without pack.json threw", err && err.message ? err.message : String(err));
  }

  const pack = chrome.loadPack();
  assert("load default pack", pack.ok === true && pack.id === chrome.PACK_ID, JSON.stringify({ ok: pack.ok, id: pack.id }));
  const missing = chrome.missingRequiredEvents(pack);
  assert("pack binds required events", missing.length === 0, JSON.stringify(missing));

  for (const id of chrome.EVENT_IDS) {
    const abs = chrome.assetPath(pack, id);
    assert(`pack file exists ${id}`, typeof abs === "string" && fs.existsSync(abs), String(abs));
  }

  const live = hitsPlayer();
  for (const id of chrome.EVENT_IDS) {
    let result;
    try {
      result = live.player.play(id);
    } catch (err) {
      fail(`play live ${id} threw`, err && err.message ? err.message : String(err));
      continue;
    }
    assert(
      `play live ${id}`,
      result && result.ok === true && result.played === true,
      JSON.stringify(result)
    );
  }
  assert("playAsset fired for each event", live.hits.length === chrome.EVENT_IDS.length, String(live.hits.length));

  try {
    const publicResult = chrome.play("ui.send");
    assert(
      "public play() safe",
      publicResult && publicResult.ok === true,
      JSON.stringify(publicResult)
    );
  } catch (err) {
    fail("public play() threw", err && err.message ? err.message : String(err));
  }

  const muted = hitsPlayer({ muted: true });
  const mutedResult = muted.player.play("ui.approve");
  assert(
    "user mute skips play",
    mutedResult.played === false && mutedResult.reason === "muted" && muted.hits.length === 0,
    JSON.stringify(mutedResult)
  );

  const reduced = hitsPlayer({ prefersReducedMotion: true });
  const reducedResult = reduced.player.play("ui.send");
  assert(
    "reduced-motion default mute",
    reducedResult.played === false && reducedResult.reason === "muted" && reduced.hits.length === 0,
    JSON.stringify(reducedResult)
  );

  const opted = hitsPlayer({ prefersReducedMotion: true, sfxDespiteReducedMotion: true });
  const optedSend = opted.player.play("ui.send");
  const optedOpen = opted.player.play("ui.code_open");
  assert("opt-in SFX during reduced-motion", optedSend.played === true, JSON.stringify(optedSend));
  assert(
    "per-event reduced_motion_mute still holds",
    optedOpen.played === false && optedOpen.reason === "muted",
    JSON.stringify(optedOpen)
  );

  let clock = 1000;
  const cool = hitsPlayer({ now() { return clock; } });
  const first = cool.player.play("ui.send");
  const second = cool.player.play("ui.send");
  clock = 1000 + 80;
  const third = cool.player.play("ui.send");
  assert("cooldown first plays", first.played === true, JSON.stringify(first));
  assert("cooldown second skips", second.played === false && second.reason === "cooldown", JSON.stringify(second));
  assert("cooldown after window plays", third.played === true, JSON.stringify(third));

  const quiet = hitsPlayer();
  const falseNeed = quiet.player.play("ui.need_you", { need_you: false });
  const falseExpand = quiet.player.play("ui.expand", { need_you: false });
  const trueNeed = quiet.player.play("ui.need_you", { need_you: true });
  assert(
    "need_you=false is quiet",
    falseNeed.played === false && falseNeed.reason === "quiet" && falseExpand.reason === "quiet",
    JSON.stringify({ falseNeed, falseExpand })
  );
  assert("need_you=true plays", trueNeed.played === true, JSON.stringify(trueNeed));

  const drawer = chrome.motion.codeDrawer();
  const expand = chrome.motion.needYouExpand();
  const drawerClose = chrome.motion.codeDrawerClose();
  assert("drawer ≤180ms", drawer.ms <= chrome.motion.CODE_DRAWER_MS_MAX && drawer.bounce === false, JSON.stringify(drawer));
  assert("expand ≤100ms", expand.ms <= chrome.motion.NEED_YOU_EXPAND_MS_MAX && expand.bounce === false, JSON.stringify(expand));
  assert("drawer open/close same ease", drawer.ms === drawerClose.ms && drawer.easing === "ease", `${drawer.ms} ${drawerClose.ms}`);
  const instant = chrome.motion.codeDrawer({ prefersReducedMotion: true });
  const instantRow = chrome.motion.needYouExpand({ prefersReducedMotion: true });
  assert("reduced-motion drawer 0ms", instant.ms === 0 && instant.instant === true && instant.transition === "none", JSON.stringify(instant));
  assert("reduced-motion expand 0ms", instantRow.ms === 0 && instantRow.instant === true, JSON.stringify(instantRow));

  const host = { style: { transition: "" } };
  chrome.motion.apply(host, drawer);
  assert("apply writes transition", host.style.transition === drawer.transition, host.style.transition);

  assert("visual lock white/slate/black", chrome.VISUAL_LOCK.white === "#ffffff" && chrome.VISUAL_LOCK.slate === "#64748b" && chrome.VISUAL_LOCK.black === "#000000", JSON.stringify(chrome.VISUAL_LOCK));

  const unknown = live.player.play("ui.not_a_real_event");
  assert("unknown event no-op", unknown.ok === true && unknown.played === false && unknown.reason === "unbound", JSON.stringify(unknown));

  process.stdout.write(`\nchrome-craft smoke passed=${passed} failed=${failed}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
