// Pruebas del scheduler del puerto virtual (sin MIDI real): puntualidad, orden, clear, jitter de clock.
"use strict";
const { MidiScheduler, epochNow } = require("../scheduler");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (ok, what) => { console.log((ok ? "OK   " : "FAIL ") + what); if (!ok) fails++; };

(async () => {
  const s = new MidiScheduler({ fake: true });
  await sleep(200);
  // 1) 400 notas a tiempos aleatorios
  const base = epochNow(), want = new Map();
  const batch = [];
  for (let i = 0; i < 400; i++) { const t = base + 20 + Math.random() * 380; want.set(i, t); batch.push({ d: [0x90, i % 128, 1 + (i >> 7)], t }); }
  s.send(batch);
  await sleep(600);
  let log = await s.sentLog();
  const lates = log.map((e) => e.at - want.get(e.d[1] + 128 * (e.d[2] - 1)));
  console.log(`     retraso medio ${(lates.reduce((a, b) => a + b, 0) / lates.length).toFixed(3)} ms, máx ${Math.max(...lates).toFixed(3)} ms`);
  check(log.length === 400, "todas las notas enviadas");
  check(log.every((e, i) => i === 0 || e.at >= log[i - 1].at), "salen en orden");
  check(Math.min(...lates) > -0.05, "ninguna antes de tiempo");
  check(Math.max(...lates) < 2, "retraso máximo < 2 ms");
  // 2) clear
  const t0 = epochNow();
  s.send(Array.from({ length: 20 }, (_, i) => ({ d: [0x90, 60, 100], t: t0 + 60 + i * 5 })));
  s.clear();
  await sleep(250);
  log = await s.sentLog();
  check(log.length === 0, "clear() vacía la cola");
  // 3) clock 174 BPM, enviado por lotes como la web (cada 20 ms con 120 ms de antelación)
  const per = 60000 / 174 / 24, start = epochNow() + 150; let k = 0;
  const end = start + 1000;
  while (epochNow() < end) {
    const b = []; while (start + k * per < epochNow() + 120 && start + k * per < end) { b.push({ d: [0xf8], t: start + k * per }); k++; }
    if (b.length) s.send(b);
    await sleep(20);
  }
  await sleep(200);
  log = await s.sentLog();
  let jit = 0; for (let i = 1; i < log.length; i++) jit = Math.max(jit, Math.abs(log[i].at - log[i - 1].at - per));
  console.log(`     clock: ${log.length} pulsos, jitter máx ${jit.toFixed(3)} ms (periodo ${per.toFixed(3)} ms)`);
  check(log.length === k, "todos los pulsos");
  check(jit < 2, "jitter del clock < 2 ms");
  await s.close();
  console.log(fails ? `\n${fails} FALLOS` : "\nTODO OK");
  process.exit(fails ? 1 : 0);
})();
