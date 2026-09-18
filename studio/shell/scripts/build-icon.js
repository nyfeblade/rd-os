"use strict";

/**
 * Rasterize build/icon.svg -> build/icon.png (1024x1024) for electron-builder.
 * electron-builder converts the PNG to .icns (mac) / .ico (win) cross-platform,
 * so this only needs a high-res square PNG. Uses rsvg-convert when present and
 * skips silently (leaving any committed PNG in place) when it is not, so the
 * packaging step never hard-fails on a machine without librsvg.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const buildDir = path.join(__dirname, "..", "build");
const svg = path.join(buildDir, "icon.svg");
const png = path.join(buildDir, "icon.png");

function hasRsvg() {
  try {
    execFileSync("rsvg-convert", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  if (!fs.existsSync(svg)) {
    process.stdout.write(`build-icon: no ${path.relative(process.cwd(), svg)}; skipping\n`);
    return;
  }
  if (!hasRsvg()) {
    if (fs.existsSync(png)) {
      process.stdout.write("build-icon: rsvg-convert missing; using existing build/icon.png\n");
      return;
    }
    process.stdout.write("build-icon: rsvg-convert missing and no build/icon.png; electron-builder will fall back to the default icon\n");
    return;
  }
  execFileSync("rsvg-convert", ["-w", "1024", "-h", "1024", svg, "-o", png], { stdio: "inherit" });
  process.stdout.write(`build-icon: wrote ${path.relative(process.cwd(), png)}\n`);
}

main();
