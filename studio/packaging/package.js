#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { MAC_PACKAGE_RECIPE, checkPreconditions } = require("./recipe");

const rootDir = __dirname;
const builderBin = path.join(rootDir, "node_modules", ".bin", "electron-builder");

const pre = checkPreconditions(MAC_PACKAGE_RECIPE, {
  platform: process.platform,
  existsSync: fs.existsSync,
  rootDir,
  builderBin,
});

if (!pre.ok) {
  process.stderr.write(`${pre.error}\n`);
  process.exit(1);
}

const electronManifest = path.join(
  path.resolve(rootDir, MAC_PACKAGE_RECIPE.electronModule),
  "package.json"
);
const installed = JSON.parse(fs.readFileSync(electronManifest, "utf8"));
const electronVersion =
  typeof installed.version === "string" ? installed.version : MAC_PACKAGE_RECIPE.electronVersion;

const configPath = path.join(rootDir, MAC_PACKAGE_RECIPE.configFile);
const args = [
  "--config",
  configPath,
  `--config.electronVersion=${electronVersion}`,
  "--mac",
  "--publish",
  "never",
].concat(MAC_PACKAGE_RECIPE.macTargets);

const env = Object.assign({}, process.env);
if (MAC_PACKAGE_RECIPE.identity === null) {
  env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
}

const result = spawnSync(builderBin, args, {
  cwd: rootDir,
  env,
  stdio: "inherit",
});

if (result.error) {
  process.stderr.write(`FAIL package: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status === 0 ? 0 : result.status || 1);
