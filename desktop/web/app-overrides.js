// EUCL desktop (osc[AV]lab) — se carga al final de la página.
// Recordar puertos MIDI + panel "Ajustes de audio y MIDI" (⌘,  o botón AUDIO).
(function () {
  "use strict";
  const A = window.EUCLAPP;
  if (!A) return;
  const $ = (id) => document.getElementById(id);
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  // ── MIDI: recordar puertos elegidos (OUT / CTRL IN / MOD IN) ──
  const SEL = { selOut: "selectOut", selIn: "selectIn", selIn2: "selectIn2" };
  const key = (sel) => "eucl.app.port." + sel;
  const nameOf = (el) => (el.selectedOptions[0] ? el.selectedOptions[0].textContent : "");
  Object.keys(SEL).forEach((sel) => {
    const fn = SEL[sel], orig = window[fn];
    if (typeof orig !== "function") return;
    // se guarda el NOMBRE del puerto (los id de Chrome pueden cambiar entre sesiones)
    window[fn] = function () { const r = orig.apply(this, arguments); const el = $(sel); if (el) lsSet(key(sel), el.value ? nameOf(el) : ""); return r; };
  });
  const _pop = window.popMIDI;
  if (typeof _pop === "function") {
    window.popMIDI = function () {
      const r = _pop.apply(this, arguments);
      Object.keys(SEL).forEach((sel) => {
        const el = $(sel), want = lsGet(key(sel), "");
        if (!el || !want || el.value) return;
        const opt = [...el.options].find((o) => o.textContent === want);
        if (opt) { el.value = opt.value; window[SEL[sel]](); }
      });
      return r;
    };
  }

  // ── Panel de ajustes ──
  const css = `
  #euclSet{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(13,13,12,.72);backdrop-filter:blur(3px)}
  #euclSet.on{display:flex}
  #euclSet .box{width:min(560px,94vw);max-height:90vh;overflow:auto;background:#141412;border:1px solid #2c2a25;border-top:2px solid #00B3A4;padding:22px 24px;color:#F4F1EA;font-family:'Roboto Condensed',sans-serif}
  #euclSet h2{margin:0 0 4px;font-size:15px;letter-spacing:.18em;font-weight:600;color:#00B3A4}
  #euclSet .sub{font:11px 'Roboto Mono',monospace;color:#7A766D;margin-bottom:16px}
  #euclSet h3{margin:18px 0 8px;font-size:11px;letter-spacing:.2em;color:#7A766D;font-weight:600}
  #euclSet label{display:grid;grid-template-columns:140px 1fr;align-items:center;gap:10px;margin:8px 0;font-size:12px;letter-spacing:.08em}
  #euclSet select{background:#0d0d0c;color:#F4F1EA;border:1px solid #2c2a25;padding:6px 8px;font:12px 'Roboto Mono',monospace}
  #euclSet .info{font:11px 'Roboto Mono',monospace;color:#A8E6DF;line-height:1.7;background:#0d0d0c;border:1px solid #242420;padding:8px 10px}
  #euclSet .warn{font-size:11px;color:#e0b44c;margin-top:6px;min-height:14px}
  #euclSet .row{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}
  #euclSet button{background:transparent;color:#F4F1EA;border:1px solid #3a3832;padding:7px 14px;font:600 11px 'Roboto Condensed',sans-serif;letter-spacing:.16em;cursor:pointer}
  #euclSet button.pri{border-color:#00B3A4;color:#00B3A4}
  #euclSet button:hover{background:#26241f}
  #euclSet .sig{text-align:center;color:#7A766D;font-size:12px;margin-top:14px}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const box = document.createElement("div");
  box.id = "euclSet";
  box.innerHTML = `<div class="box">
    <h2>AJUSTES DE AUDIO Y MIDI</h2><div class="sub" id="esVer">EUCL</div>
    <h3>AUDIO</h3>
    <label>SALIDA <select id="esSink"></select></label>
    <div style="text-align:right"><button id="esNames" style="display:none;padding:4px 10px">VER NOMBRES DE LAS SALIDAS</button></div>
    <label>BUFFER <select id="esBuf">
      <option value="0">Auto (bajo)</option><option value="128">128 muestras</option><option value="256">256 muestras</option>
      <option value="512">512 muestras</option><option value="1024">1024 muestras</option><option value="2048">2048 muestras</option></select></label>
    <label>FRECUENCIA <select id="esRate">
      <option value="0">Auto (la del dispositivo)</option><option value="44100">44,1 kHz</option><option value="48000">48 kHz</option><option value="96000">96 kHz</option></select></label>
    <div class="warn" id="esWarn"></div>
    <div class="info" id="esAudio">—</div>
    <h3>MIDI</h3>
    <div class="info" id="esMidi">—</div>
    <div class="row"><button id="esApply" class="pri" style="display:none">APLICAR Y RECARGAR</button><button id="esClose">CERRAR</button></div>
    <div class="sig">ž</div></div>`;
  document.body.appendChild(box);

  const cfg = (() => { try { return JSON.parse(lsGet("eucl.app.audio", "{}")) || {}; } catch (e) { return {}; } })();
  const saveCfg = () => lsSet("eucl.app.audio", JSON.stringify(cfg));
  const loaded = { buffer: cfg.buffer || 0, rate: cfg.rate || 0 };
  let midiStat = null, info = null;
  A.onStat((s) => { midiStat = s; if (box.classList.contains("on")) renderMidi(); });
  A.info().then((i) => { info = i; $("esVer").textContent = `app v${i.version} · web ${i.web} · Chrome ${String(i.chrome).split(".")[0]}`; });

  async function fillSinks() {
    const sel = $("esSink");
    let devs = [];
    try { devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audiooutput"); } catch (e) {}
    sel.innerHTML = "";
    const def = document.createElement("option"); def.value = ""; def.textContent = "Salida del sistema"; sel.appendChild(def);
    devs.filter((d) => d.deviceId !== "default" && d.deviceId !== "communications").forEach((d, i) => {
      const o = document.createElement("option"); o.value = d.deviceId; o.textContent = d.label || "Salida " + (i + 1); sel.appendChild(o);
    });
    sel.value = cfg.sink || "";
    if (sel.value !== (cfg.sink || "")) sel.value = "";
    // macOS sólo da los nombres de las salidas tras permitir el micrófono una vez
    $("esNames").style.display = devs.some((d) => !d.label) ? "" : "none";
  }
  async function askNames() {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); } catch (e) {}
    fillSinks();
  }
  function renderAudio() {
    const c = window.__euclCtx;
    const el = $("esAudio");
    if (!c) { el.textContent = "El audio arranca al pulsar PLAY."; return; }
    const ms = (x) => (x ? (x * 1000).toFixed(1) + " ms" : "—");
    el.innerHTML = `estado: ${c.state} · ${c.sampleRate} Hz<br>latencia base: ${ms(c.baseLatency)} · latencia de salida: ${ms(c.outputLatency)}`;
  }
  function renderMidi() {
    const m = window.__euclMidi;
    const outs = m ? [...m.access.outputs.values()].map((p) => p.name) : [];
    const ins = m ? [...m.access.inputs.values()].map((p) => p.name) : [];
    let s = `puertos virtuales: EUCL (entrada y salida, Ableton los ve)<br>salidas: ${outs.join(" · ") || "—"}<br>entradas: ${ins.join(" · ") || "—"}`;
    if (midiStat && midiStat.n) s += `<br>precisión EUCL virtual: ${midiStat.mean.toFixed(2)} ms (máx ${midiStat.max.toFixed(2)})`;
    $("esMidi").innerHTML = s;
  }
  function changed() {
    const need = (cfg.buffer || 0) !== loaded.buffer || (cfg.rate || 0) !== loaded.rate;
    $("esApply").style.display = need ? "" : "none";
    $("esWarn").textContent = need ? "Buffer y frecuencia se aplican al recargar: guarda antes tu preset (el patrón en curso se pierde)." : "";
  }
  async function open() {
    await fillSinks();
    $("esBuf").value = String(cfg.buffer || 0);
    $("esRate").value = String(cfg.rate || 0);
    renderAudio(); renderMidi(); changed();
    box.classList.add("on");
  }
  const close = () => box.classList.remove("on");
  $("esSink").onchange = async (e) => {
    cfg.sink = e.target.value || ""; saveCfg();
    const c = window.__euclCtx;
    if (c && c.setSinkId) { try { await c.setSinkId(cfg.sink); $("esWarn").textContent = ""; } catch (err) { $("esWarn").textContent = "No se pudo usar esa salida: " + err.message; } }
    renderAudio();
  };
  $("esBuf").onchange = (e) => { cfg.buffer = +e.target.value || 0; saveCfg(); changed(); };
  $("esRate").onchange = (e) => { cfg.rate = +e.target.value || 0; saveCfg(); changed(); };
  $("esNames").onclick = askNames;
  $("esApply").onclick = () => A.relaunch();
  $("esClose").onclick = close;
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && box.classList.contains("on")) close(); });
  A.onOpenSettings(open);
  setInterval(() => { if (box.classList.contains("on")) renderAudio(); }, 1000);

  // botón AUDIO junto a los selectores MIDI
  const anchor = $("selOut");
  if (anchor && anchor.parentNode) {
    const b = document.createElement("button");
    b.className = "btn"; b.textContent = "AUDIO"; b.title = "Ajustes de audio y MIDI (⌘,)";
    b.onclick = open;
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
  }
})();
