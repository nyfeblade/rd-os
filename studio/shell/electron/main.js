"use strict";

const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createChatSession, defaultRepoPath } = require("../lib/chat-bridge");
const { tryReadCatalogP0 } = require("../lib/read-catalog");
const { demoInbox, mergeWireConnectors, sendReply } = require("../lib/two-way");

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
    ...(isMac ? { trafficLightPosition: { x: 16, y: 18 } } : {}),
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
  return mergeWireConnectors(tryReadCatalogP0());
});

ipcMain.handle("studio:inbox", () => {
  return demoInbox();
});

ipcMain.handle("studio:reply", (_event, draft) => {
  return sendReply(draft);
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

let chatSession = null;

function chat() {
  if (!chatSession) {
    throw new Error("chat session not started");
  }
  return chatSession;
}

ipcMain.handle("studio:chat.bind", (_event, repo) => {
  return chat().bind(repo);
});

ipcMain.handle("studio:chat.state", () => {
  return { ok: true, state: chat().state() };
});

ipcMain.handle("studio:chat.send", (_event, text) => {
  return chat().send(text);
});

ipcMain.handle("studio:chat.refresh", () => {
  return chat().refresh();
});

ipcMain.handle("studio:chat.focus", (_event, open) => {
  return chat().setCodeFocus(open);
});

ipcMain.handle("studio:chat.selectRepo", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const picked = await dialog.showOpenDialog(win, {
    title: "Bind repo",
    properties: ["openDirectory"],
  });
  if (picked.canceled || !picked.filePaths[0]) {
    return { ok: true, state: chat().state() };
  }
  return chat().bind(picked.filePaths[0]);
});

app.whenReady().then(() => {
  chatSession = createChatSession({
    varDir: path.join(app.getPath("userData"), "studio"),
    repo: defaultRepoPath(),
  });
  chatSession.bind().catch((err) => {
    process.stderr.write(`chat bind: ${err && err.message ? err.message : String(err)}\n`);
  });
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
