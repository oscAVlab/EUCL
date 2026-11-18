# EUCL · app de escritorio con motor Chrome (osc[AV]lab) — v0.2

La web de **EUCL** (`../index.html`, la de GitHub Pages) dentro de una app de Mac hecha con **Electron (Chrome 140)**.
Sustituye a la versión con Safari/WKWebView (`../app/`), que se volvía lenta y con glitches de audio con el tiempo.

- **Ajustes de audio y MIDI** (⌘, o botón **AUDIO**): salida de audio (cualquier interfaz), buffer (128–2048 muestras), frecuencia (44,1/48/96 kHz), latencias reales.
- **Puertos virtuales "EUCL"** (entrada y salida) que Ableton ve sin IAC. La salida virtual tiene su propio
  scheduler de tiempo real (hilo aparte con `Atomics.wait`): respeta los timestamps de la web (notas, clock 24 PPQN).
- Hardware y demás puertos: **Web MIDI nativo de Chrome** (el mismo de la web en Chrome, con timestamps).
- Recuerda los puertos elegidos (por nombre), ventana, ajustes; no se frena en segundo plano (sin App Nap ni throttling).
- Funciona sin internet (fuentes incluidas); la NUBE de presets necesita conexión.

## Instalar (Mac)

Requisito (una vez): `brew install node`

```bash
zsh "$HOME/_LAB/Devices/EUCL/EUCL/desktop/mac/Compilar.command"
```

Actualizar: `zsh "$HOME/_LAB/Devices/EUCL/EUCL/desktop/mac/Actualizar.command"`

## Archivos

| Archivo | Qué hace |
|---|---|
| `main.js` | Ventana, protocolo `eucl://` que sirve la web con fuentes locales, permisos MIDI/audio, menú, puertos virtuales |
| `scheduler.js` + `midi-worker.js` | Scheduler del puerto virtual EUCL (montículo por tiempo, espera sub-ms, `clear()` en Stop) |
| `preload.js` | Puente seguro web ⇄ app |
| `web/app-bridge.js` | Al inicio del `<head>`: AudioContext con buffer/frecuencia/salida; Web MIDI de Chrome + puertos virtuales |
| `web/app-overrides.js` | Al final: panel de ajustes, botón AUDIO, recordar puertos |
| `scripts/prepare-web.js` | Copia la web, logo y fuentes a `www/` (lo que se empaqueta) |
| `tests/` | `npm test` (scheduler) y `EUCL_SELFTEST=1 npx electron .` (prueba dentro de la app) |
