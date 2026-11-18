// EUCL desktop — puente seguro entre la web y el proceso principal
"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const midiCbs = [], statCbs = [], openCbs = [];
ipcRenderer.on("midi-in", (_e, msgs) => midiCbs.forEach((f) => f(msgs)));
ipcRenderer.on("midi-stat", (_e, s) => statCbs.forEach((f) => f(s)));
ipcRenderer.on("open-settings", () => openCbs.forEach((f) => f()));
contextBridge.exposeInMainWorld("EUCLAPP", {
  midiSend: (batch) => ipcRenderer.send("midi-send", batch),
  midiClear: () => ipcRenderer.send("midi-clear"),
  setInputWanted: (on) => ipcRenderer.send("midi-in-wanted", !!on),
  onMidi: (f) => midiCbs.push(f),
  onStat: (f) => statCbs.push(f),
  onOpenSettings: (f) => openCbs.push(f),
  info: () => ipcRenderer.invoke("info"),
  relaunch: () => ipcRenderer.send("reload"),
});
