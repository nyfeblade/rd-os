"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studioShell", {
  platform: () => ipcRenderer.invoke("studio:platform"),
  loadDump: (name) => ipcRenderer.invoke("studio:loadDump", name),
  loadCatalog: () => ipcRenderer.invoke("studio:catalog"),
  loadInbox: () => ipcRenderer.invoke("studio:inbox"),
  reply: (draft) => ipcRenderer.invoke("studio:reply", draft),
  chat: {
    bind: (repo) => ipcRenderer.invoke("studio:chat.bind", repo),
    state: () => ipcRenderer.invoke("studio:chat.state"),
    send: (text) => ipcRenderer.invoke("studio:chat.send", text),
    refresh: () => ipcRenderer.invoke("studio:chat.refresh"),
    selectRepo: () => ipcRenderer.invoke("studio:chat.selectRepo"),
    setCodeFocus: (open) => ipcRenderer.invoke("studio:chat.focus", open),
  },
  seats: {
    connect: (provider) => ipcRenderer.invoke("studio:seats.connect", provider),
    list: () => ipcRenderer.invoke("studio:seats.list"),
    presence: () => ipcRenderer.invoke("studio:seats.presence"),
    providers: () => ipcRenderer.invoke("studio:seats.providers"),
  },
});
