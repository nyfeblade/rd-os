"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studioShell", {
  platform: () => ipcRenderer.invoke("studio:platform"),
  loadCatalog: () => ipcRenderer.invoke("studio:catalog"),
  loadInbox: () => ipcRenderer.invoke("studio:inbox"),
  reply: (draft) => ipcRenderer.invoke("studio:reply", draft),
  live: {
    state: () => ipcRenderer.invoke("studio:live.state"),
  },
  auth: {
    start: () => ipcRenderer.invoke("studio:auth.start"),
    session: () => ipcRenderer.invoke("studio:auth.session"),
    signOut: () => ipcRenderer.invoke("studio:auth.signOut"),
    callback: (payload) => ipcRenderer.invoke("studio:auth.callback", payload),
  },
  seats: {
    connect: (provider) => ipcRenderer.invoke("studio:seats.connect", provider),
    dump: () => ipcRenderer.invoke("studio:seats.dump"),
    list: () => ipcRenderer.invoke("studio:seats.list"),
    presence: () => ipcRenderer.invoke("studio:seats.presence"),
    providers: () => ipcRenderer.invoke("studio:seats.providers"),
    import: () => ipcRenderer.invoke("studio:seats.import"),
  },
  hitl: {
    create: (input) => ipcRenderer.invoke("studio:hitl.create", input),
    needYou: () => ipcRenderer.invoke("studio:hitl.needYou"),
    resolve: (input) => ipcRenderer.invoke("studio:hitl.resolve", input),
  },
  market: {
    browse: (query) => ipcRenderer.invoke("studio:market.browse", query),
    install: (id) => ipcRenderer.invoke("studio:market.install", id),
    connect: (id) => ipcRenderer.invoke("studio:market.connect", id),
  },
  modes: {
    list: () => ipcRenderer.invoke("studio:modes.list"),
    enable: (id) => ipcRenderer.invoke("studio:modes.enable", id),
  },
  mcp: {
    surface: () => ipcRenderer.invoke("studio:mcp.surface"),
  },
  chat: {
    bind: (repo) => ipcRenderer.invoke("studio:chat.bind", repo),
    state: () => ipcRenderer.invoke("studio:chat.state"),
    send: (text) => ipcRenderer.invoke("studio:chat.send", text),
    refresh: () => ipcRenderer.invoke("studio:chat.refresh"),
    selectRepo: () => ipcRenderer.invoke("studio:chat.selectRepo"),
    setCodeFocus: (open) => ipcRenderer.invoke("studio:chat.focus", open),
  },
});
