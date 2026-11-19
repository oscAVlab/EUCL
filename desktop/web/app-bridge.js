// EUCL desktop (osc[AV]lab) — se carga al inicio del <head>, antes que la web.
// 1) AudioContext con el buffer / frecuencia / salida elegidos en Ajustes.
// 2) MIDI nativo (CoreMIDI): puertos virtuales "EUCL" + todas las interfaces, salida con scheduler de tiempo real.
(function () {
  "use strict";
  const A = window.EUCLAPP;
  if (!A) return;

  // ── Audio ──
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem("eucl.app.audio") || "{}") || {}; } catch (e) {}
  const Orig = window.AudioContext;
  if (Orig) {
    class EuclAudioContext extends Orig {
      constructor(opts) {
        const o = Object.assign({}, opts || {});
        if (cfg.rate) o.sampleRate = cfg.rate;
        if (cfg.buffer) o.latencyHint = cfg.buffer / (cfg.rate || 48000);
        else if (!o.latencyHint) o.latencyHint = "interactive";
        let ctx;
        try { super(o); } catch (e) { super(); }   // si el dispositivo no acepta esa frecuencia
        ctx = this;
        window.__euclCtx = ctx;
        if (cfg.sink && ctx.setSinkId) ctx.setSinkId(cfg.sink).catch((e) => console.warn("salida de audio:", e));
      }
    }
    window.AudioContext = EuclAudioContext;
    window.webkitAudioContext = EuclAudioContext;
  }

  // ── MIDI ──
  // Todo por CoreMIDI nativo: puerto virtual "EUCL" + interfaces/IAC/Ableton, con salida programada en tiempo real.
  let batch = [], queued = false;
  const flush = () => { queued = false; if (batch.length) { const b = batch; batch = []; A.midiSend(b); } };
  class NPort {
    constructor(id, name, type, port) { this.id = id; this.name = name; this.type = type; this._p = port; this.manufacturer = ""; this.version = ""; this.state = "connected"; this.connection = "open"; this.onstatechange = null; }
    open() { return Promise.resolve(this); }
    close() { return Promise.resolve(this); }
  }
  class NOut extends NPort {
    send(data, ts) {
      const d = Array.from(data, (b) => b & 0xff);
      if (!d.length || d[0] === 0xf0) return;
      const t = Number(ts) > performance.now() ? performance.timeOrigin + Number(ts) : 0;   // reloj común: epoch en ms
      batch.push({ d, t, p: this._p });
      if (!queued) { queued = true; queueMicrotask(flush); }
    }
    clear() { batch = []; A.midiClear(); }
  }
  class NIn extends NPort {
    constructor(...a) { super(...a); this._h = null; this._ls = new Set(); }
    get onmidimessage() { return this._h; }
    set onmidimessage(h) { this._h = typeof h === "function" ? h : null; this._sync(); }
    addEventListener(t, f) { if (t === "midimessage") { this._ls.add(f); this._sync(); } }
    removeEventListener(t, f) { if (t === "midimessage") { this._ls.delete(f); this._sync(); } }
    _sync() { A.setInputWanted(!!this._h || this._ls.size > 0, this._p); }
    _dispatch(ev) { if (this._h) this._h(ev); this._ls.forEach((f) => f(ev)); }
  }
  const VOUT = "eucl-virtual-out", VIN = "eucl-virtual-in";
  const outs = new Map([[VOUT, new NOut(VOUT, "EUCL (virtual)", "output", "")]]);
  const ins = new Map([[VIN, new NIn(VIN, "EUCL (virtual)", "input", "")]]);
  const byPort = (p) => { for (const x of ins.values()) if (x._p === p) return x; return null; };
  A.onMidi((msgs) => {
    const now = performance.now();
    for (const m of msgs) {
      const port = byPort(m.p || ""); if (!port) continue;
      let ts = m.t - performance.timeOrigin;
      if (!(ts > now - 1000) || ts > now) ts = now;
      port._dispatch({ data: new Uint8Array(m.d), timeStamp: ts, target: port, currentTarget: port });
    }
  });
  const access = { inputs: new Map(), outputs: new Map(), sysexEnabled: false, onstatechange: null };
  const apply = (list) => {
    list = list || { outputs: [], inputs: [] };
    for (const n of list.outputs) { const id = "hw-out:" + n; if (!outs.has(id)) outs.set(id, new NOut(id, n, "output", n)); }
    for (const n of list.inputs) { const id = "hw-in:" + n; if (!ins.has(id)) ins.set(id, new NIn(id, n, "input", n)); }
    access.outputs.clear(); access.inputs.clear();
    for (const [id, p] of outs) if (!p._p || list.outputs.includes(p._p)) access.outputs.set(id, p);
    for (const [id, p] of ins) if (!p._p || list.inputs.includes(p._p)) { access.inputs.set(id, p); if (p._h || p._ls.size) p._sync(); }
  };
  A.onPorts((list) => { apply(list); if (typeof access.onstatechange === "function") access.onstatechange({ port: null }); });
  let ready = null;
  navigator.requestMIDIAccess = function () {
    if (!ready) ready = A.midiPorts().then((list) => { apply(list); window.__euclMidi = { access }; return access; });
    return ready;
  };
})();
