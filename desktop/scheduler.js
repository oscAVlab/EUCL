// EUCL desktop — lado principal del scheduler (crea el hilo y le pasa los mensajes)
"use strict";
const path = require("path");
const { Worker, MessageChannel } = require("worker_threads");

class MidiScheduler {
  constructor({ name = "EUCL", fake = false, onStat } = {}) {
    this.flagBuf = new SharedArrayBuffer(4);
    this.flag = new Int32Array(this.flagBuf);
    const { port1, port2 } = new MessageChannel();
    this.port = port1;
    this.worker = new Worker(path.join(__dirname, "midi-worker.js"), {
      workerData: { port: port2, flagBuf: this.flagBuf, fake, name },
      transferList: [port2],
    });
    this.worker.on("message", (m) => { if (m.stat && onStat) onStat(m.stat); if (m.sent && this._statsCb) { this._statsCb(m.sent); this._statsCb = null; } });
    this.worker.on("error", (e) => console.error("midi-worker", e));
  }
  _wake() { Atomics.store(this.flag, 0, 1); Atomics.notify(this.flag, 0); }
  // batch: [{d:[bytes], t: ms epoch (0 = ahora)}]
  send(batch) { this.port.postMessage({ batch }); this._wake(); }
  clear() { this.port.postMessage({ clear: true }); this._wake(); }
  sentLog() { return new Promise((r) => { this._statsCb = r; this.port.postMessage({ stats: true }); this._wake(); }); }
  async close() { this.port.postMessage({ quit: true }); this._wake(); await new Promise((r) => setTimeout(r, 50)); await this.worker.terminate(); }
}
module.exports = { MidiScheduler, epochNow: () => performance.timeOrigin + performance.now() };
