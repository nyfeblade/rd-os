"use strict";

/**
 * Produce macOS .dmg installers for AI Coding Studio on Linux (no macOS host).
 *
 * Pipeline (the same one Bitcoin Core uses for its reproducible macOS releases):
 *   1. build/icon.png            <- rsvg-convert (scripts/build-icon.js)
 *   2. AI Coding Studio.app      <- electron-builder --mac dir (assembles the
 *                                   bundle from the official darwin electron zip)
 *   3. dmg staging dir           <- the .app + a /Applications drop symlink
 *   4. <name>.iso (HFS hybrid)   <- genisoimage -apple
 *   5. <name>.dmg (UDZO/UDIF)    <- libdmg-hfsplus `dmg`
 *
 * The resulting .dmg is UNSIGNED. Code signing + notarization require a real Mac
 * with Apple Developer credentials; run `electron-builder --mac dmg` there to get
 * a signed artifact. This script gives a mountable, installable dmg for testing
 * and internal distribution from CI/Linux.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const shellDir = path.join(__dirname, "..");
const distDir = path.join(shellDir, "dist");
const pkg = require(path.join(shellDir, "package.json"));
const VERSION = pkg.version || "0.0.0";
const PRODUCT = "AI Coding Studio";

const ARCHES = process.env.DMG_ARCHES
  ? process.env.DMG_ARCHES.split(",").map((a) => a.trim()).filter(Boolean)
  : ["x64", "arm64"];

function run(cmd, args, opts = {}) {
  process.stdout.write(`$ ${cmd} ${args.join(" ")}\n`);
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

function which(cmd) {
  try {
    execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function requireTool(cmd, hint) {
  if (!which(cmd)) {
    throw new Error(`missing required tool: ${cmd}${hint ? ` (${hint})` : ""}`);
  }
}

// electron-builder writes x64 to dist/mac and arm64 to dist/mac-arm64.
function appOutDir(arch) {
  return arch === "x64" ? path.join(distDir, "mac") : path.join(distDir, `mac-${arch}`);
}

function buildApps() {
  run("node", [path.join(shellDir, "scripts", "build-icon.js")]);
  const args = ["electron-builder", "--mac", "dir", ...ARCHES.map((a) => `--${a}`)];
  run("npx", args, { cwd: shellDir, env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" } });
}

function makeDmg(arch) {
  const appDir = appOutDir(arch);
  const appPath = path.join(appDir, `${PRODUCT}.app`);
  if (!fs.existsSync(appPath)) {
    throw new Error(`app bundle not found for ${arch}: ${appPath}`);
  }

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), `dmg-${arch}-`));
  // Populate the volume: the .app plus a drag-to-install /Applications shortcut.
  run("cp", ["-a", appPath, path.join(staging, `${PRODUCT}.app`)]);
  fs.symlinkSync("/Applications", path.join(staging, "Applications"));

  const isoPath = path.join(distDir, `${PRODUCT}-${VERSION}-${arch}.iso`);
  const dmgPath = path.join(distDir, `${PRODUCT}-${VERSION}-${arch}.dmg`);
  fs.rmSync(isoPath, { force: true });
  fs.rmSync(dmgPath, { force: true });

  run("genisoimage", [
    "-no-cache-inodes",
    "-D",
    "-l",
    "-probe",
    "-V", PRODUCT,
    "-no-pad",
    "-r",
    "-dir-mode", "0755",
    "-apple",
    "-o", isoPath,
    staging,
  ]);

  run("dmg", [isoPath, dmgPath]);
  fs.rmSync(isoPath, { force: true });
  fs.rmSync(staging, { recursive: true, force: true });
  return dmgPath;
}

function main() {
  requireTool("npx");
  requireTool("genisoimage", "apt-get install genisoimage");
  requireTool("dmg", "build libdmg-hfsplus and put `dmg` on PATH");

  buildApps();

  const built = [];
  for (const arch of ARCHES) {
    built.push(makeDmg(arch));
  }

  process.stdout.write("\nBuilt DMG artifacts:\n");
  for (const p of built) {
    const size = fs.statSync(p).size;
    process.stdout.write(`  ${p}  (${(size / 1024 / 1024).toFixed(1)} MB)\n`);
  }
  process.stdout.write("\nNOTE: these are UNSIGNED. Sign + notarize on macOS for public distribution.\n");
}

main();
