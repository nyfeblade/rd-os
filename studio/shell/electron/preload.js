"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studioShell", {
  platform: () => ipcRenderer.invoke("studio:platform"),
  loadDump: (name) => ipcRenderer.invoke("studio:loadDump", name),
  loadCatalog: () => ipcRenderer.invoke("studio:catalog"),
  loadInbox: () => ipcRenderer.invoke("studio:inbox"),
  reply: (draft) => ipcRenderer.invoke("studio:reply", draft),
});
