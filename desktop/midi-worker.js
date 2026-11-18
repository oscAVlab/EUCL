// EUCL desktop (osc[AV]lab) — scheduler MIDI para el puerto virtual "EUCL".
// Hilo propio: duerme con Atomics.wait (precisión sub-ms) y envía cada mensaje en su hora.
// La web programa notas y clock por adelantado con timestamps (como Web MIDI).
"use strict";
const { parentPort, workerData, receiveMessageOnPort } = require("worker_threads");
const { port, flagBuf, fake } = workerData;
const flag = new Int32Array(flagBuf);
const now = () => performance.timeOrigin + performance.now();   // ms epoch, alta resolución

const SPIN_MS = 0.6, MAX_WAIT = 100, MAX_QUEUE = 20000;
let out = null, sent = [];
if (fake) out = { sendMessage: (d) => sent.push({ at: now(), d }) };
else {
  try {
    const midi = require("@julusian/midi");
    out = new midi.Output();
    out.openVirtualPort(workerData.name || "EUCL");
  } catch (e) {
    console.error("MIDI out virtual no disponible:", e.message);
    out = { sendMessage() {}, closePort() {} };
  }
}

// montículo por (t, seq)
const heap = []; let seq = 0;
const less = (a, b) => a.t < b.t || (a.t === b.t && a.s < b.s);
function push(e) { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!less(heap[i], heap[p])) break; [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; } }
function pop() { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; }

let lateSum = 0, lateMax = 0, lateN = 0, lastStat = now(), running = true;
function handle(msg) {
  if (msg.quit) { running = false; return; }
  if (msg.clear) { heap.length = 0; return; }
  if (msg.stats) { parentPort.postMessage({ sent }); sent = []; return; }
  for (const m of msg.batch || []) {
    if (heap.length >= MAX_QUEUE) break;
    push({ t: m.t > 0 ? m.t : 0, s: seq++, d: m.d });
  }
}

while (running) {
  let m;
  while ((m = receiveMessageOnPort(port))) handle(m.message);
  if (!running) break;
  const t = now();
  while (heap.length && heap[0].t <= t + 0.02) {
    const e = pop();
    try { out.sendMessage(e.d); } catch (err) {}
    if (e.t > 0) { const late = Math.max(0, now() - e.t); if (late < 50) { lateSum += late; lateMax = Math.max(lateMax, late); lateN++; } }
  }
  if (t - lastStat > 1500 && !fake) {
    parentPort.postMessage({ stat: { mean: lateN ? lateSum / lateN : 0, max: lateMax, n: lateN, queue: heap.length } });
    lateSum = lateMax = lateN = 0; lastStat = t;
  }
  const wait = heap.length ? heap[0].t - now() : MAX_WAIT;
  if (Atomics.exchange(flag, 0, 0) !== 0) continue;           // llegó algo nuevo
  if (wait > SPIN_MS + 0.2) Atomics.wait(flag, 0, 0, Math.min(MAX_WAIT, wait - SPIN_MS));
  // si no, espera activa breve: vuelve al bucle
}
try { if (!fake) out.closePort(); } catch (e) {}
