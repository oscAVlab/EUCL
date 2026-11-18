// EUCL app (osc[AV]lab) — puente nativo, se inyecta al inicio del documento.
// Sustituye Web MIDI por CoreMIDI nativo (JUCE). Los timestamps de Web MIDI se respetan:
// la web programa notas y clock por adelantado y el scheduler nativo las envía a su hora.
(function () {
  "use strict";
  if (window.EU) return;
  const be = () => window.__JUCE__.backend;

  // --- llamadas a funciones nativas (mismo protocolo que el index.js de JUCE) ---
  let nextId = 1;
  const pending = new Map();
  be().addEventListener("__juce__complete", ({ promiseId, result }) => {
    const r = pending.get(promiseId);
    if (r) { pending.delete(promiseId); r(result); }
  });
  function call(name, ...params) {
    return new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      be().emitEvent("__juce__invoke", { name, params, resultId: id });
    });
  }
  const emit = (id, payload) => be().emitEvent(id, payload);
  const on = (id, fn) => be().addEventListener(id, fn);

  // --- localStorage: copia en disco gestionada por la app (presets LOCAL, sesión, offset) ---
  (function () {
    let ls = null;
    try { ls = window.localStorage; } catch (e) { return; }
    const saved = window.__EU_STORE || {};
    const savedKeys = Object.keys(saved);
    const proto = Storage.prototype;
    const _set = proto.setItem, _rem = proto.removeItem, _clr = proto.clear;
    try {
      if (savedKeys.length) savedKeys.forEach((k) => _set.call(ls, k, String(saved[k])));
      else for (let i = 0; i < ls.length; i++) { const k = ls.key(i); emit("eu_store", { k, v: ls.getItem(k) }); }
    } catch (e) {}
    proto.setItem = function (k, v) { _set.call(this, k, v); if (this === ls) emit("eu_store", { k: String(k), v: String(v) }); };
    proto.removeItem = function (k) { _rem.call(this, k); if (this === ls) emit("eu_store", { k: String(k), del: true }); };
    proto.clear = function () { _clr.call(this); if (this === ls) emit("eu_store", { clear: true }); };
  })();

  // --- reloj: offset entre performance.now() y el reloj del scheduler nativo ---
  // Se mide varias veces y se queda la muestra con menor ida y vuelta (error ≤ rtt/2).
  const clock = { off: 0, rtt: Infinity, synced: false };
  async function syncClock(samples) {
    let best = null;
    for (let i = 0; i < samples; i++) {
      const t0 = performance.now();
      const n = await call("eu_now");
      const t1 = performance.now();
      const rtt = t1 - t0;
      if (!best || rtt < best.rtt) best = { rtt, off: n - (t0 + t1) / 2 };
    }
    // aceptar si es tan buena como la anterior (o la anterior ya es vieja)
    if (best && (!clock.synced || best.rtt <= clock.rtt * 1.5 + 0.2)) {
      clock.off = best.off; clock.rtt = best.rtt; clock.synced = true;
    }
    clock.rtt += 0.05;   // la calidad "envejece": permite re-sincronizar poco a poco
  }
  const firstSync = syncClock(12);
  setInterval(() => syncClock(6), 5000);

  // --- MIDI ---
  // Los envíos de una misma vuelta del scheduler web van juntos en un solo mensaje nativo.
  let batch = [];
  let flushQueued = false;
  function flush() { flushQueued = false; if (!batch.length) return; const b = batch; batch = []; emit("eu_midi_send", b); }

  class Port {
    constructor(info, type) {
      this.id = info.id; this.name = info.name; this.type = type;
      this.manufacturer = "osc[AV]lab"; this.version = "";
      this.state = "connected"; this.connection = "open";
      this.virtual = !!info.virtual;
      this.onstatechange = null;
    }
    open() { return Promise.resolve(this); }
    close() { return Promise.resolve(this); }
  }
  class Output extends Port {
    constructor(info) { super(info, "output"); }
    send(data, timestamp) {
      const d = Array.from(data, (b) => b & 0xff);
      if (!d.length || d[0] === 0xf0) return;              // sin SysEx
      const ts = Number(timestamp);
      const t = ts > performance.now() ? ts + clock.off : 0;   // 0 = ahora
      batch.push({ id: this.id, d, t });
      if (!flushQueued) { flushQueued = true; queueMicrotask(flush); }
    }
    clear() {
      batch = batch.filter((m) => m.id !== this.id);
      emit("eu_midi_clear", { id: this.id });
    }
  }
  class Input extends Port {
    constructor(info) { super(info, "input"); this._h = null; this._ls = new Set(); }
    get onmidimessage() { return this._h; }
    set onmidimessage(h) { this._h = typeof h === "function" ? h : null; this._sync(); }
    addEventListener(t, f) { if (t === "midimessage") { this._ls.add(f); this._sync(); } }
    removeEventListener(t, f) { if (t === "midimessage") { this._ls.delete(f); this._sync(); } }
    _sync() { emit("eu_midi_in", { id: this.id, open: !!this._h || this._ls.size > 0 }); }
    _dispatch(ev) { if (this._h) this._h(ev); this._ls.forEach((f) => f(ev)); }
  }

  const access = { inputs: new Map(), outputs: new Map(), sysexEnabled: false, onstatechange: null };
  function applyList(list) {
    const sync = (map, infos, Cls) => {
      const seen = new Set();
      infos.forEach((info) => {
        seen.add(info.id);
        if (!map.has(info.id)) map.set(info.id, new Cls(info));
        else map.get(info.id).name = info.name;
      });
      [...map.keys()].forEach((k) => { if (!seen.has(k)) map.delete(k); });
    };
    // recrear los Map en el orden nativo (el virtual primero)
    const ins = new Map(access.inputs), outs = new Map(access.outputs);
    sync(ins, list.inputs || [], Input);
    sync(outs, list.outputs || [], Output);
    access.inputs.clear(); (list.inputs || []).forEach((i) => access.inputs.set(i.id, ins.get(i.id)));
    access.outputs.clear(); (list.outputs || []).forEach((o) => access.outputs.set(o.id, outs.get(o.id)));
    // re-abrir entradas que siguen teniendo handler
    access.inputs.forEach((p) => { if (p._h || p._ls.size) p._sync(); });
  }
  on("eu_midi_changed", (list) => {
    applyList(list);
    if (typeof access.onstatechange === "function") access.onstatechange({ port: null });
  });
  on("eu_midi_msgs", (msgs) => {
    const now = performance.now();
    for (const m of msgs) {
      const p = access.inputs.get(m.id);
      if (!p) continue;
      // instante real de llegada (reloj nativo → performance.now): el reloj externo lo usa para medir el tempo
      let ts = m.t ? m.t - clock.off : now;
      if (!(ts >= now - 1000)) ts = now; else if (ts > now) ts = now;
      p._dispatch({ data: new Uint8Array(m.d), timeStamp: ts, receivedTime: ts, target: p, currentTarget: p });
    }
  });

  let accessPromise = null;
  Object.defineProperty(navigator, "requestMIDIAccess", {
    configurable: true,
    value: function () {
      if (!accessPromise)
        accessPromise = firstSync.then(() => call("eu_midi_list")).then((list) => { applyList(list || {}); return access; });
      return accessPromise;
    },
  });

  window.EU = { call, emit, on, midi: access, clock, native: true };
})();
