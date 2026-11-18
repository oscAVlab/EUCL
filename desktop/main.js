// EUCL desktop (osc[AV]lab) — la web de EUCL con el motor de Chrome (Electron):
// salida de audio y buffer elegibles, Web MIDI nativo de Chrome y puertos virtuales "EUCL".
"use strict";
const { app, BrowserWindow, protocol, session, ipcMain, Menu, powerSaveBlocker, shell, net } = require("electron");
const path = require("path"), fs = require("fs"), url = require("url");
const { MidiScheduler, epochNow } = require("./scheduler");

const APP_VERSION = require("./package.json").version.replace(/\.0$/, "");
const WWW = path.join(__dirname, "www");
const VNAME = "EUCL";

app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
protocol.registerSchemesAsPrivileged([{ scheme: "eucl", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();

let win = null, sched = null, vin = null, inWanted = false;
const webVersion = (() => { try { return fs.readFileSync(path.join(WWW, "web-version.txt"), "utf8").trim(); } catch (e) { return "?"; } })();

// ── ventana: recordar posición/tamaño ──
const stateFile = () => path.join(app.getPath("userData"), "ventana.json");
const loadBounds = () => { try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")); } catch (e) { return { width: 1440, height: 920 }; } };
const saveBounds = () => { try { if (win) fs.writeFileSync(stateFile(), JSON.stringify(win.getBounds())); } catch (e) {} };

// ── index.html de la web con fuentes locales y los scripts de la app ──
function patchedIndex() {
  let html = fs.readFileSync(path.join(WWW, "index.html"), "utf8");
  html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, '<link href="fonts.css" rel="stylesheet">');
  html = html.replace(/<link rel="preconnect"[^>]*>/g, "");
  html = html.replace(/<head>/i, '<head>\n<script src="app-bridge.js"></script>');
  const i = html.lastIndexOf("</body>");
  return html.slice(0, i) + '<script src="app-overrides.js"></script>\n' + html.slice(i);
}
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", woff2: "font/woff2", png: "image/png", json: "application/json" };

function createWindow() {
  const b = loadBounds();
  win = new BrowserWindow({
    ...b, minWidth: 900, minHeight: 600, backgroundColor: "#0d0d0c",
    title: `EUCL · Seq Euclidean x4 · osc[AV]lab`,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.on("close", saveBounds);
  win.on("closed", () => { win = null; });
  win.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https?:/.test(u)) shell.openExternal(u); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, u) => { if (/^https?:/.test(u)) { e.preventDefault(); shell.openExternal(u); } });
  win.loadURL("eucl://app/index.html");
}

function buildMenu() {
  const tpl = [
    { label: "EUCL", submenu: [
      { label: `EUCL · app v${APP_VERSION} · web ${webVersion}`, enabled: false },
      { type: "separator" },
      { label: "Ajustes de audio y MIDI…", accelerator: "CmdOrCtrl+,", click: () => win && win.webContents.send("open-settings") },
      { type: "separator" }, { role: "hide", label: "Ocultar EUCL" }, { role: "hideOthers", label: "Ocultar otros" }, { type: "separator" },
      { role: "quit", label: "Salir de EUCL" } ] },
    { label: "Edición", submenu: [{ role: "undo", label: "Deshacer" }, { role: "redo", label: "Rehacer" }, { type: "separator" }, { role: "cut", label: "Cortar" }, { role: "copy", label: "Copiar" }, { role: "paste", label: "Pegar" }, { role: "selectAll", label: "Seleccionar todo" }] },
    { label: "Ver", submenu: [{ role: "reload", label: "Recargar" }, { role: "toggleDevTools", label: "Herramientas de desarrollo" }, { type: "separator" }, { role: "resetZoom", label: "Tamaño real" }, { role: "zoomIn", label: "Ampliar" }, { role: "zoomOut", label: "Reducir" }, { type: "separator" }, { role: "togglefullscreen", label: "Pantalla completa" }] },
    { role: "windowMenu", label: "Ventana" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

// ── puertos virtuales "EUCL" ──
function startVirtualMidi() {
  sched = new MidiScheduler({ name: VNAME, onStat: (s) => win && win.webContents.send("midi-stat", s) });
  try {
    const midi = require("@julusian/midi");
    vin = new midi.Input();
    vin.ignoreTypes(true, false, true);   // ignora SysEx y Active Sensing; deja pasar el clock
    vin.on("message", (_dt, msg) => { if (inWanted && win) win.webContents.send("midi-in", [{ d: msg, t: epochNow(), p: "" }]); });
    vin.openVirtualPort(VNAME);
  } catch (e) { console.error("MIDI in virtual:", e); }
  // puertos físicos: CoreMIDI directo (no depende del Web MIDI de Chrome)
  setInterval(pollPorts, 2000); pollPorts();
}
let ports = { outputs: [], inputs: [] };
const hwIn = new Map();   // nombre → Input abierto
function listPorts() {
  const midi = require("@julusian/midi"), r = { outputs: [], inputs: [] };
  try { const o = new midi.Output(); for (let i = 0; i < o.getPortCount(); i++) r.outputs.push(o.getPortName(i)); o.closePort && o.closePort(); } catch (e) {}
  try { const n = new midi.Input(); for (let i = 0; i < n.getPortCount(); i++) r.inputs.push(n.getPortName(i)); n.closePort && n.closePort(); } catch (e) {}
  r.outputs = [...new Set(r.outputs.filter((x) => x && x !== VNAME))];
  r.inputs = [...new Set(r.inputs.filter((x) => x && x !== VNAME))];
  return r;
}
function pollPorts() {
  const r = listPorts();
  if (JSON.stringify(r) === JSON.stringify(ports)) return;
  ports.outputs.filter((x) => !r.outputs.includes(x)).forEach((x) => sched && sched.forget(x));
  ports.inputs.filter((x) => !r.inputs.includes(x)).forEach((x) => setHwIn(x, false));
  ports = r;
  if (win) win.webContents.send("midi-ports", ports);
}
function setHwIn(name, on) {
  const cur = hwIn.get(name);
  if (!on) { if (cur) { try { cur.closePort(); } catch (e) {} hwIn.delete(name); } return; }
  if (cur) return;
  try {
    const midi = require("@julusian/midi"), inp = new midi.Input();
    for (let i = 0; i < inp.getPortCount(); i++) if (inp.getPortName(i) === name) {
      inp.ignoreTypes(true, false, true);
      inp.on("message", (_dt, msg) => { if (win) win.webContents.send("midi-in", [{ d: msg, t: epochNow(), p: name }]); });
      inp.openPort(i); hwIn.set(name, inp); return;
    }
  } catch (e) { console.error("MIDI in", name, e.message); }
}

app.whenReady().then(() => {
  powerSaveBlocker.start("prevent-app-suspension");   // sin App Nap con la ventana detrás de Ableton
  const ses = session.defaultSession;
  const allowed = new Set(["midi", "media", "speaker-selection", "clipboard-sanitized-write", "fullscreen"]);
  ses.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed.has(perm)));
  ses.setPermissionCheckHandler((_wc, perm) => allowed.has(perm));
  ses.setDevicePermissionHandler(() => true);

  protocol.handle("eucl", (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === "/" || p === "/index.html") return new Response(patchedIndex(), { headers: { "content-type": MIME.html } });
    const file = path.join(WWW, path.basename(p));
    if (!fs.existsSync(file)) return new Response("", { status: 404 });
    const ext = path.extname(file).slice(1);
    return new Response(fs.readFileSync(file), { headers: { "content-type": MIME[ext] || "application/octet-stream" } });
  });

  ipcMain.on("midi-send", (_e, batch) => { if (Array.isArray(batch) && sched) sched.send(batch.filter((m) => Array.isArray(m.d) && m.d.length && m.d.length <= 3 && m.d[0] >= 0x80 && m.d[0] !== 0xf0 && (m.p === undefined || m.p === "" || ports.outputs.includes(m.p)))); });
  ipcMain.on("midi-clear", () => sched && sched.clear());
  ipcMain.on("midi-in-wanted", (_e, on, port) => { if (!port) inWanted = !!on; else if (ports.inputs.includes(port)) setHwIn(port, !!on); });
  ipcMain.handle("midi-ports", () => ports);
  ipcMain.on("reload", () => win && win.webContents.reloadIgnoringCache());
  ipcMain.handle("info", () => ({ version: APP_VERSION, web: webVersion, electron: process.versions.electron, chrome: process.versions.chrome }));

  startVirtualMidi();
  buildMenu();
  createWindow();
  if (process.env.EUCL_SELFTEST) require("./tests/selftest")(win, app);
});
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on("activate", () => { if (!win) createWindow(); });
app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => { try { vin && vin.closePort(); } catch (e) {} hwIn.forEach((x) => { try { x.closePort(); } catch (e) {} }); if (sched) sched.close(); });
