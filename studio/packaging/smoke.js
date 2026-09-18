#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  MAC_PACKAGE_RECIPE,
  toBuilderConfig,
  renderBuilderYml,
  parseYml,
  issuesInBuilderConfig,
  checkPreconditions,
} = require("./recipe");

const ROOT = __dirname;
const builderPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(ROOT, MAC_PACKAGE_RECIPE.configFile);

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

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function main() {
  const required = [
    "README.md",
    "package.json",
    "package.js",
    "recipe.js",
    "smoke.js",
    "builder.yml",
  ];
  for (const rel of required) {
    assert(`artifact ${rel}`, fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`);
  }

  assert("builder.yml path", fs.existsSync(builderPath), `missing ${builderPath}`);

  const pkg = JSON.parse(read("package.json"));
  assert("npm run package", pkg.scripts.package === "node package.js", String(pkg.scripts.package));
  assert("npm test", pkg.scripts.test === "node smoke.js", String(pkg.scripts.test));
  assert("no package.json build field", pkg.build === undefined, JSON.stringify(pkg.build));

  let parsed;
  try {
    parsed = parseYml(fs.readFileSync(builderPath, "utf8"));
    pass("parse builder.yml");
  } catch (err) {
    fail("parse builder.yml", err && err.message ? err.message : String(err));
    parsed = null;
  }

  const issues = parsed ? issuesInBuilderConfig(parsed) : ["unparsed"];
  assert("builder.yml schema", issues.length === 0, JSON.stringify(issues));

  if (parsed) {
    assert(
      "directories.app is ../shell",
      parsed.directories && parsed.directories.app === "../shell",
      JSON.stringify(parsed.directories)
    );
    assert(
      "extraMetadata.dependencies is null",
      parsed.extraMetadata && parsed.extraMetadata.dependencies === null,
      JSON.stringify(parsed.extraMetadata)
    );
    assert("electronVersion is pinned", parsed.electronVersion === "37.10.3", String(parsed.electronVersion));
    assert("npmRebuild is false", parsed.npmRebuild === false, String(parsed.npmRebuild));
    assert("mac.identity is null", parsed.mac && parsed.mac.identity === null, JSON.stringify(parsed.mac));
    assert(
      "mac targets are dmg and zip",
      parsed.mac &&
        Array.isArray(parsed.mac.target) &&
        parsed.mac.target.length === 2 &&
        parsed.mac.target[0] === "dmg" &&
        parsed.mac.target[1] === "zip",
      JSON.stringify(parsed.mac && parsed.mac.target)
    );
    assert(
      "recipe projection matches yml",
      JSON.stringify(parsed) === JSON.stringify(toBuilderConfig(MAC_PACKAGE_RECIPE)),
      JSON.stringify(parsed)
    );
    assert(
      "render matches committed yml",
      renderBuilderYml(MAC_PACKAGE_RECIPE) === fs.readFileSync(builderPath, "utf8"),
      "renderBuilderYml drifted from builder.yml"
    );
  }

  const rawYml = fs.readFileSync(builderPath, "utf8");
  assert("no win key", !/^win\s*:/m.test(rawYml), rawYml);
  assert("no linux key", !/^linux\s*:/m.test(rawYml), rawYml);
  assert("no nsis key", !/^nsis\s*:/m.test(rawYml), rawYml);
  assert("no portable key", !/^portable\s*:/m.test(rawYml), rawYml);

  const winConfig = parseYml("appId: x\nwin:\n  target: nsis\n");
  const winIssues = issuesInBuilderConfig(winConfig);
  assert(
    "schema rejects win",
    winIssues.some((row) => row === "forbidden key win"),
    JSON.stringify(winIssues)
  );

  const signed = parseYml(renderBuilderYml(MAC_PACKAGE_RECIPE).replace("identity: null", 'identity: "Developer ID"'));
  const signedIssues = issuesInBuilderConfig(signed);
  assert(
    "schema rejects a signing identity",
    signedIssues.some((row) => row === "mac.identity must be null"),
    JSON.stringify(signedIssues)
  );

  const missingElectron = checkPreconditions(MAC_PACKAGE_RECIPE, {
    platform: "darwin",
    existsSync() {
      return false;
    },
    rootDir: ROOT,
  });
  assert(
    "missing electron fails",
    missingElectron.ok === false &&
      missingElectron.error ===
        "FAIL package: ../shell/node_modules/electron is missing. Run npm install in studio/shell.",
    JSON.stringify(missingElectron)
  );

  const windowsHost = checkPreconditions(MAC_PACKAGE_RECIPE, {
    platform: "win32",
    existsSync() {
      return true;
    },
    rootDir: ROOT,
  });
  assert(
    "win32 host fails",
    windowsHost.ok === false &&
      windowsHost.error === "FAIL package: Windows targets are not supported.",
    JSON.stringify(windowsHost)
  );

  const linuxHost = checkPreconditions(MAC_PACKAGE_RECIPE, {
    platform: "linux",
    existsSync() {
      return true;
    },
    rootDir: ROOT,
  });
  assert(
    "linux host fails",
    linuxHost.ok === false &&
      linuxHost.error === "FAIL package: Mac packaging requires macOS.",
    JSON.stringify(linuxHost)
  );

  const ready = checkPreconditions(MAC_PACKAGE_RECIPE, {
    platform: "darwin",
    existsSync() {
      return true;
    },
    rootDir: ROOT,
    builderBin: "/tmp/electron-builder-present",
  });
  assert("darwin with electron is ready", ready.ok === true && ready.error === null, JSON.stringify(ready));

  const spawned = spawnSync(process.execPath, [path.join(ROOT, "package.js")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert(
    "package.js CLI refuses a non-Mac host",
    spawned.status === 1 &&
      typeof spawned.stderr === "string" &&
      spawned.stderr.includes("Mac packaging requires macOS"),
    `status=${spawned.status} stderr=${spawned.stderr}`
  );

  const readme = read("README.md");
  assert("readme installs to ~/Applications", readme.includes("~/Applications"), "missing ~/Applications");
  assert("readme uses npm run package", readme.includes("npm run package"), "missing npm run package");
  assert("readme uses npm test", readme.includes("npm test"), "missing npm test");
  assert("readme names the .app", readme.includes("AI Coding Studio.app"), "missing AI Coding Studio.app");
  assert("readme is not a Windows path", !/Windows/i.test(readme) && !/nsis/i.test(readme), "Windows path documented");

  const recipeSrc = read("recipe.js");
  const packageSrc = read("package.js");
  const smokeSrc = fs.readFileSync(__filename, "utf8");
  for (const [name, src] of [
    ["recipe.js", recipeSrc],
    ["package.js", packageSrc],
    ["smoke.js", smokeSrc],
  ]) {
    assert(
      `${name} imports stay at top`,
      !/\nfunction [^\n]+\n[^\n]*\brequire\(/.test(src) && !/\n  require\(/.test(src),
      "inline require"
    );
  }

  const fence = spawnSync("git", ["diff", "--name-only", "HEAD", "--", "studio/shell"], {
    cwd: path.resolve(ROOT, "../.."),
    encoding: "utf8",
  });
  assert(
    "no shell file writes",
    fence.status === 0 && fence.stdout.trim() === "",
    fence.stdout || fence.stderr || `status=${fence.status}`
  );

  process.stdout.write(`\npackaging smoke passed=${passed} failed=${failed}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
