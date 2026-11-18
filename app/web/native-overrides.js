// EUCL app (osc[AV]lab) — reemplazos nativos, se carga al final de la página.
// La web original queda intacta; aquí sólo se cambia lo que en la app va a macOS:
// recordar puertos MIDI, guardar archivos con diálogo nativo y abrir enlaces en el navegador.
(function () {
  "use strict";
  if (!window.EU) return;
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);
  const KEYS = { selOut: "eucl.app.out", selIn: "eucl.app.in", selIn2: "eucl.app.in2" };
  const SELECT = { selOut: "selectOut", selIn: "selectIn", selIn2: "selectIn2" };
  const lsGet = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v || ""); } catch (e) {} };

  // ── MIDI: recordar los puertos elegidos y recuperarlos al volver a aparecer ──
  Object.keys(SELECT).forEach((sel) => {
    const fn = SELECT[sel], orig = window[fn];
    if (typeof orig !== "function") return;
    window[fn] = function () { const r = orig.apply(this, arguments); const el = $(sel); if (el) lsSet(KEYS[sel], el.value); return r; };
  });
  const _pop = window.popMIDI;
  if (typeof _pop === "function") {
    window.popMIDI = function () {
      const r = _pop.apply(this, arguments);
      Object.keys(SELECT).forEach((sel) => {
        const el = $(sel), want = lsGet(KEYS[sel]);
        if (!el || !want) return;
        const has = [...el.options].some((o) => o.value === want);
        if (has && el.value !== want) { el.value = want; const f = window[SELECT[sel]]; if (f) f(); }
        else if (!has && el.value === "") {/* el puerto aún no está: se recupera cuando aparezca */}
      });
      return r;
    };
  }

  // ── Archivos: EXPORT (a.download con blob:) → diálogo "Guardar" de macOS ──
  const blobs = new Map();
  const _create = URL.createObjectURL.bind(URL), _revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = function (obj) { const u = _create(obj); if (obj instanceof Blob) blobs.set(u, obj); return u; };
  URL.revokeObjectURL = function (u) { setTimeout(() => { blobs.delete(u); _revoke(u); }, 60000); };
  function toBase64(buf) {
    const bytes = new Uint8Array(buf); let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  async function saveHref(href, name) {
    let blob = blobs.get(href);
    if (!blob) blob = await (await fetch(href)).blob();
    const res = await EU.call("eu_save_file", name || "eucl_preset.json", toBase64(await blob.arrayBuffer()));
    if (res && res.ok === false && res.error) alert("No se pudo guardar: " + res.error);
  }
  const _click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const href = this.href || "";
    if (this.hasAttribute("download") && /^(blob|data):/.test(href)) { saveHref(href, this.getAttribute("download")); return; }
    if (/^https?:/.test(href) && (this.target === "_blank" || !href.startsWith(location.origin))) { EU.call("eu_open_url", href); return; }
    return _click.call(this);
  };
  // enlaces externos reales (clic del usuario) → navegador del sistema
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    if (/^https?:/.test(a.href)) { e.preventDefault(); EU.call("eu_open_url", a.href); }
  }, true);
  window.open = function (u) { if (u && /^https?:/.test(String(u))) EU.call("eu_open_url", String(u)); return null; };

  // ── marca "APP" junto a la versión ──
  EU.call("eu_info").then((info) => {
    const v = document.querySelector(".brand-app .ver");
    if (v && info) v.title = "app v" + info.version + " · web " + info.web + (info.realtime ? " · scheduler RT" : "");
  });
})();
