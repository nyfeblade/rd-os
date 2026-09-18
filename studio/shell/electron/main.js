"use strict";

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const { createChatSession, defaultRepoPath } = require("../lib/chat-bridge");
const { tryReadCatalogP0 } = require("../lib/read-catalog");
const { mergeWireConnectors, sendReply } = require("../lib/two-way");
const { createStudioLive } = require("../lib/studio-live");
const { createSeatsSession } = require("../lib/seats-bridge");
const { runSeatConnectClick } = require("../lib/seat-connect");

const MIN_WIDTH = 1200;
const MIN_HEIGHT = 720;
const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;

let live = null;
let chatSession = null;
let seatsSession = null;

function catalogRows() {
  return mergeWireConnectors(tryReadCatalogP0());
}

function liveState() {
  return live.snapshot(catalogRows());
}

function seats() {
  if (!seatsSession) {
    throw new Error("seats session not started");
  }
  return seatsSession;
}

function chat() {
  if (!chatSession) {
    throw new Error("chat session not started");
  }
  return chatSession;
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
  return catalogRows();
});

ipcMain.handle("studio:inbox", () => {
  return live.inbox();
});

ipcMain.handle("studio:reply", (_event, draft) => {
  return sendReply(draft);
});

ipcMain.handle("studio:live.state", () => {
  return liveState();
});

ipcMain.handle("studio:auth.start", async () => {
  const started = live.startOAuth();
  if (!started.ok) {
    return started;
  }
  if (started.url) {
    await shell.openExternal(started.url);
    started.opened = true;
  }
  return started;
});

ipcMain.handle("studio:auth.session", () => {
  return live.session();
});

ipcMain.handle("studio:auth.signOut", () => {
  return live.signOut();
});

ipcMain.handle("studio:auth.callback", async (_event, payload) => {
  return live.handleCallback(payload);
});

ipcMain.handle("studio:seats.connect", (_event, provider) => {
  return runSeatConnectClick({ session: seats(), provider });
});

ipcMain.handle("studio:seats.dump", () => {
  return live.dumpSeats();
});

ipcMain.handle("studio:seats.list", () => {
  return seats().list();
});

ipcMain.handle("studio:seats.presence", () => {
  return seats().presence();
});

ipcMain.handle("studio:seats.providers", () => {
  return { ok: true, providers: seats().providers() };
});

ipcMain.handle("studio:seats.import", () => {
  return seats().importTeam();
});

ipcMain.handle("studio:hitl.create", (_event, input) => {
  return live.createGate(input);
});

ipcMain.handle("studio:hitl.needYou", () => {
  return live.listNeedYou();
});

ipcMain.handle("studio:hitl.resolve", (_event, input) => {
  return live.resolveGate(input);
});

ipcMain.handle("studio:market.browse", (_event, query) => {
  return live.browseMarket(query);
});

ipcMain.handle("studio:market.install", (_event, id) => {
  return live.installMarket(id);
});

ipcMain.handle("studio:market.connect", (_event, id) => {
  return live.connectMarket(id);
});

ipcMain.handle("studio:modes.list", () => {
  return live.listModes();
});

ipcMain.handle("studio:modes.enable", (_event, id) => {
  return live.enableMode(id);
});

ipcMain.handle("studio:mcp.surface", () => {
  return live.mcpSurface();
});

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
  const studioHome = path.join(app.getPath("userData"), "studio");
  live = createStudioLive({
    varDir: studioHome,
    platform: process.platform,
  });
  seatsSession = createSeatsSession({
    studio: live.seats,
    home: path.join(studioHome, "seats"),
    env: process.env,
  });
  chatSession = createChatSession({
    varDir: studioHome,
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
  if (live) {
    live.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
