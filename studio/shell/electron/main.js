"use strict";

const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { tryReadCatalogP0 } = require("../lib/read-catalog");

const MIN_WIDTH = 1200;
const MIN_HEIGHT = 720;
const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;

function fixturePath(name) {
  return path.join(__dirname, "..", "renderer", "fixtures", name);
}

function readFixture(name) {
  return JSON.parse(fs.readFileSync(fixturePath(name), "utf8"));
}

function createWindow() {
  const isMac = process.platform === "darwin";
  const isWin = process.platform === "win32";

  const win = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: "AI Coding Studio",
    backgroundColor: "#ffffff",
    show: false,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    ...(isWin
      ? {
          titleBarOverlay: {
            color: "#ffffff",
            symbolColor: "#111111",
            height: 38,
          },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  return win;
}

ipcMain.handle("studio:platform", () => {
  switch (process.platform) {
    case "darwin":
      return "mac";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    default:
      return "desktop";
  }
});

ipcMain.handle("studio:catalog", () => {
  return tryReadCatalogP0();
});

ipcMain.handle("studio:loadDump", (_event, name) => {
  const allowed = new Set([
    "attention.dump.json",
    "attention.empty.json",
    "attention.human.json",
  ]);
  if (!allowed.has(name)) {
    throw new Error(`unknown stub dump: ${name}`);
  }
  return readFixture(name);
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
