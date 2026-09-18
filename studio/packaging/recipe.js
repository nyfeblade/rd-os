"use strict";

const path = require("path");

const MAC_PACKAGE_RECIPE = Object.freeze({
  productName: "AI Coding Studio",
  appId: "dev.rdos.studio",
  appDir: "../shell",
  electronModule: "../shell/node_modules/electron",
  electronVersion: "37.10.3",
  outputDir: "dist",
  configFile: "builder.yml",
  macTargets: Object.freeze(["dmg", "zip"]),
  identity: null,
  installDir: "~/Applications",
  category: "public.app-category.developer-tools",
  npmRebuild: false,
  files: Object.freeze([
    "package.json",
    "electron/**/*",
    "lib/**/*",
    "renderer/**/*",
  ]),
  killTargets: Object.freeze(["win", "nsis", "portable", "linux"]),
});

function toBuilderConfig(recipe) {
  return {
    appId: recipe.appId,
    productName: recipe.productName,
    electronVersion: recipe.electronVersion,
    npmRebuild: recipe.npmRebuild,
    extraMetadata: {
      dependencies: null,
    },
    directories: {
      app: recipe.appDir,
      output: recipe.outputDir,
    },
    files: recipe.files.slice(),
    mac: {
      identity: recipe.identity,
      category: recipe.category,
      target: recipe.macTargets.slice(),
    },
  };
}

function renderBuilderYml(recipe) {
  const lines = [
    `appId: ${recipe.appId}`,
    `productName: "${recipe.productName}"`,
    `electronVersion: "${recipe.electronVersion}"`,
    `npmRebuild: ${recipe.npmRebuild}`,
    "extraMetadata:",
    "  dependencies: null",
    "directories:",
    `  app: ${recipe.appDir}`,
    `  output: ${recipe.outputDir}`,
    "files:",
  ];
  for (const glob of recipe.files) {
    lines.push(`  - ${glob}`);
  }
  lines.push("mac:");
  lines.push("  identity: null");
  lines.push(`  category: ${recipe.category}`);
  lines.push("  target:");
  for (const target of recipe.macTargets) {
    lines.push(`    - ${target}`);
  }
  lines.push("");
  return lines.join("\n");
}

function decodeScalar(raw) {
  const value = raw.trim();
  if (value === "" || value === "null" || value === "~") {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value.length >= 2) {
    const start = value[0];
    const end = value[value.length - 1];
    if ((start === '"' && end === '"') || (start === "'" && end === "'")) {
      return value.slice(1, -1);
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

function peekNextContent(lines, index) {
  for (let i = index + 1; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const indent = raw.match(/^ */)[0].length;
    return { indent, content: raw.slice(indent) };
  }
  return null;
}

function parseYml(text) {
  if (typeof text !== "string") {
    throw new Error("yml must be a string");
  }
  const lines = text.split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, value: root, kind: "map" }];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (raw.includes("\t")) {
      throw new Error("yml tabs are not allowed");
    }
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const indent = raw.match(/^ */)[0].length;
    const content = raw.slice(indent);

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];

    if (content.startsWith("- ")) {
      if (parent.kind !== "list") {
        throw new Error(`yml list item without a list: ${content}`);
      }
      parent.value.push(decodeScalar(content.slice(2)));
      continue;
    }

    const colon = content.indexOf(":");
    if (colon === -1) {
      throw new Error(`yml expected a key: ${content}`);
    }
    if (parent.kind !== "map") {
      throw new Error(`yml map entry in a list: ${content}`);
    }

    const key = content.slice(0, colon).trim();
    const rest = content.slice(colon + 1).trim();
    if (rest !== "") {
      parent.value[key] = decodeScalar(rest);
      continue;
    }

    const next = peekNextContent(lines, i);
    if (!next || next.indent <= indent) {
      parent.value[key] = null;
      continue;
    }
    const child = next.content.startsWith("- ") ? [] : {};
    parent.value[key] = child;
    stack.push({
      indent,
      value: child,
      kind: Array.isArray(child) ? "list" : "map",
    });
  }

  return root;
}

function issuesInBuilderConfig(config) {
  const issues = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    issues.push("config is not a map");
    return issues;
  }

  for (const key of MAC_PACKAGE_RECIPE.killTargets) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      issues.push(`forbidden key ${key}`);
    }
  }

  const expected = toBuilderConfig(MAC_PACKAGE_RECIPE);
  if (config.appId !== expected.appId) {
    issues.push(`appId ${String(config.appId)}`);
  }
  if (config.productName !== expected.productName) {
    issues.push(`productName ${String(config.productName)}`);
  }
  if (config.electronVersion !== expected.electronVersion) {
    issues.push(`electronVersion ${String(config.electronVersion)}`);
  }
  if (config.npmRebuild !== expected.npmRebuild) {
    issues.push(`npmRebuild ${String(config.npmRebuild)}`);
  }
  if (
    !config.extraMetadata ||
    typeof config.extraMetadata !== "object" ||
    config.extraMetadata.dependencies !== null
  ) {
    issues.push("extraMetadata.dependencies must be null");
  }
  if (!config.directories || typeof config.directories !== "object") {
    issues.push("directories is not a map");
  } else {
    if (config.directories.app !== expected.directories.app) {
      issues.push(`directories.app ${String(config.directories.app)}`);
    }
    if (config.directories.output !== expected.directories.output) {
      issues.push(`directories.output ${String(config.directories.output)}`);
    }
  }
  if (!Array.isArray(config.files) || JSON.stringify(config.files) !== JSON.stringify(expected.files)) {
    issues.push(`files ${JSON.stringify(config.files)}`);
  }
  if (!config.mac || typeof config.mac !== "object") {
    issues.push("mac is not a map");
    return issues;
  }
  if (config.mac.identity !== null) {
    issues.push("mac.identity must be null");
  }
  if (config.mac.category !== expected.mac.category) {
    issues.push(`mac.category ${String(config.mac.category)}`);
  }
  if (JSON.stringify(config.mac.target) !== JSON.stringify(expected.mac.target)) {
    issues.push(`mac.target ${JSON.stringify(config.mac.target)}`);
  }
  return issues;
}

function checkPreconditions(recipe, options) {
  if (options.platform === "win32") {
    return {
      ok: false,
      error: "FAIL package: Windows targets are not supported.",
    };
  }

  if (options.platform !== "darwin") {
    return {
      ok: false,
      error: "FAIL package: Mac packaging requires macOS.",
    };
  }

  const electronPkg = path.join(
    path.resolve(options.rootDir, recipe.electronModule),
    "package.json"
  );
  if (!options.existsSync(electronPkg)) {
    return {
      ok: false,
      error: `FAIL package: ${recipe.electronModule} is missing. Run npm install in studio/shell.`,
    };
  }

  if (options.builderBin && !options.existsSync(options.builderBin)) {
    return {
      ok: false,
      error: "FAIL package: electron-builder is missing. Run npm install in studio/packaging.",
    };
  }

  return { ok: true, error: null };
}

module.exports = {
  MAC_PACKAGE_RECIPE,
  toBuilderConfig,
  renderBuilderYml,
  parseYml,
  issuesInBuilderConfig,
  checkPreconditions,
};
