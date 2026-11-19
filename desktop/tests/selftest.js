// Prueba automática dentro de la app real (Electron): EUCL_SELFTEST=1 npx electron .
"use strict";
module.exports = (win, app) => {
  const wc = win.webContents;
  const ev = (js) => wc.executeJavaScript(js, true);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  wc.on("console-message", (_e, level, msg) => { if (level >= 2) console.log("[web]", msg); });
  wc.once("did-finish-load", async () => {
    try {
      await sleep(1500);
      console.log("puertos", JSON.stringify(await ev(`({out:[...document.getElementById('selOut').options].map(o=>o.text),ins:[...document.getElementById('selIn').options].map(o=>o.text),audioBtn:!!document.querySelector('#euclSet')})`)));
      await ev(`document.getElementById('selOut').value='eucl-virtual-out';selectOut();document.getElementById('btnClkOut').click();document.getElementById('btnPlay').click();`);
      await sleep(4000);
      console.log("tocando", JSON.stringify(await ev(`({sc:!!(fxBus&&fxBus.comp),knobs:KNOBS.length,playing:S.playing,idx:TRACKS.map(t=>t.activeIdx),sr:__euclCtx&&__euclCtx.sampleRate,base:__euclCtx&&__euclCtx.baseLatency,state:__euclCtx&&__euclCtx.state,mem:localStorage.getItem('eucl.app.port.selOut')})`)));
      await ev(`EUCLAPP && document.querySelector('.btn[title^="Ajustes"]').click()`);
      await sleep(1200);
      const img = await wc.capturePage();
      require("fs").writeFileSync(process.env.EUCL_SELFTEST_SHOT || "/tmp/eucl-selftest.png", img.toPNG());
      console.log("ajustes", JSON.stringify(await ev(`({abierto:document.getElementById('euclSet').classList.contains('on'),sinks:[...document.getElementById('esSink').options].map(o=>o.text),audio:document.getElementById('esAudio').innerText,midi:document.getElementById('esMidi').innerText})`)));
    } catch (e) { console.log("ERROR", e); }
    app.quit();
  });
};
