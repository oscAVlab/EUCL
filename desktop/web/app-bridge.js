// EUCL desktop (osc[AV]lab) — se carga al inicio del <head>, antes que la web.
// 1) AudioContext con el buffer / frecuencia / salida elegidos en Ajustes.
// 2) Web MIDI de Chrome + puertos virtuales "EUCL" (salida con scheduler de tiempo real).
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
  const VOUT = "eucl-virtual-out", VIN = "eucl-virtual-in";
  let batch = [], queued = false;
  const flush = () => { queued = false; if (batch.length) { const b = batch; batch = []; A.midiSend(b); } };
  class VPort {
    constructor(id, type) { this.id = id; this.name = "EUCL (virtual)"; this.type = type; this.manufacturer = "osc[AV]lab"; this.version = ""; this.state = "connected"; this.connection = "open"; this.onstatechange = null; }
    open() { return Promise.resolve(this); }
    close() { return Promise.resolve(this); }
  }
  class VOut extends VPort {
    constructor() { super(VOUT, "output"); }
    send(data, ts) {
      const d = Array.from(data, (b) => b & 0xff);
      if (!d.length || d[0] === 0xf0) return;
      const t = Number(ts) > performance.now() ? performance.timeOrigin + Number(ts) : 0;   // reloj común: epoch en ms
      batch.push({ d, t });
      if (!queued) { queued = true; queueMicrotask(flush); }
    }
    clear() { batch = []; A.midiClear(); }
  }
  class VIn extends VPort {
    constructor() { super(VIN, "input"); this._h = null; this._ls = new Set(); }
    get onmidimessage() { return this._h; }
    set onmidimessage(h) { this._h = typeof h === "function" ? h : null; this._sync(); }
    addEventListener(t, f) { if (t === "midimessage") { this._ls.add(f); this._sync(); } }
    removeEventListener(t, f) { if (t === "midimessage") { this._ls.delete(f); this._sync(); } }
    _sync() { A.setInputWanted(!!this._h || this._ls.size > 0); }
    _dispatch(ev) { if (this._h) this._h(ev); this._ls.forEach((f) => f(ev)); }
  }
  const vout = new VOut(), vin = new VIn();
  A.onMidi((msgs) => {
    const now = performance.now();
    for (const m of msgs) {
      let ts = m.t - performance.timeOrigin;
      if (!(ts > now - 1000) || ts > now) ts = now;
      vin._dispatch({ data: new Uint8Array(m.d), timeStamp: ts, target: vin, currentTarget: vin });
    }
  });

  const origReq = navigator.requestMIDIAccess ? navigator.requestMIDIAccess.bind(navigator) : null;
  let accessPromise = null;
  const isOwn = (p) => p && p.name === "EUCL";   // nuestros propios puertos vistos por Chrome
  navigator.requestMIDIAccess = function () {
    if (accessPromise) return accessPromise;
    accessPromise = (async () => {
      let real = null;
      try { if (origReq) real = await origReq({ sysex: false }); } catch (e) { console.warn("Web MIDI:", e); }
      const access = { inputs: new Map(), outputs: new Map(), sysexEnabled: false, onstatechange: null };
      const rebuild = () => {
        access.inputs.clear(); access.outputs.clear();
        access.inputs.set(VIN, vin); access.outputs.set(VOUT, vout);
        if (real) {
          for (const [id, p] of real.inputs) if (!isOwn(p)) access.inputs.set(id, p);
          for (const [id, p] of real.outputs) if (!isOwn(p)) access.outputs.set(id, p);
        }
      };
      rebuild();
      if (real) real.onstatechange = (e) => { rebuild(); if (typeof access.onstatechange === "function") access.onstatechange(e); };
      window.__euclMidi = { access, real };
      return access;
    })();
    return accessPromise;
  };
})();
