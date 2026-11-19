# EUCL · app para macOS (osc[AV]lab)

La web de **EUCL · Seq Euclidean x4** (la misma de `../index.html` / GitHub Pages) dentro de una app de Mac,
con **MIDI nativo (CoreMIDI)** en lugar de Web MIDI.

- **Puertos MIDI virtuales "EUCL"** (entrada y salida): Ableton los ve sin IAC.
- **Timing preciso**: la web programa notas y clock con ~120 ms de antelación (timestamps); la app los guarda en
  una cola y un hilo de tiempo real los envía a su hora exacta (prueba en Linux: clock 24 PPQN con jitter < 0,05 ms).
- **Reloj externo** con el instante real de llegada de cada pulso (CoreMIDI), para medir bien el tempo.
- No se frena en segundo plano (App Nap y frenado de timers del WKWebView desactivados).
- Presets LOCAL y sesión guardados también en `~/Library/Application Support/osc[AV]lab/EUCL.settings`.
- EXPORT abre el diálogo "Guardar" de macOS; IMPORT el de abrir.
- Recuerda los puertos MIDI elegidos (OUT, CTRL IN, MOD IN).
- Funciona sin internet (fuentes incluidas); la NUBE de presets necesita conexión.

Guía de uso e instalación: [docs/GUIA.md](docs/GUIA.md) · Cambios: [CHANGELOG.md](CHANGELOG.md)

## Instalar (Mac)

```bash
git clone -b claude/project-thread-w0vzcd https://github.com/oscAVlab/EUCL.git "$HOME/_LAB/Devices/EUCL" && zsh "$HOME/_LAB/Devices/EUCL/app/mac/Compilar.command"
```

Requisitos (una vez): `xcode-select --install` y `brew install cmake`.

## Cómo está hecho

| Archivo | Qué hace |
|---|---|
| `Source/MainComponent.*` | Ventana: WKWebView (JUCE 8 `WebBrowserComponent`) que sirve `../index.html` desde la app, puertos CoreMIDI, guardado de archivos, copia de localStorage |
| `Source/MidiScheduler.*` | Cola por tiempo + hilo tiempo real: envía cada mensaje en su instante (espera + último 0,6 ms activo); `clear()` por puerto (Stop) |
| `Source/MacSupport.mm` | alert/confirm/prompt nativos en WKWebView, sin frenado de timers, App Nap off |
| `web/native-bridge.js` | Se inyecta al inicio: `navigator.requestMIDIAccess` → CoreMIDI; sincroniza `performance.now()` con el reloj nativo (muestra de menor ida y vuelta) y convierte los timestamps |
| `web/native-overrides.js` | Al final de la página: recordar puertos, EXPORT con diálogo, enlaces al navegador |
| `tests/SchedulerTests.cpp` | Orden, puntualidad, `clear()` y jitter del clock |

La web **no se modifica**: al compilar se embebe `../index.html` tal cual, así la app siempre es la misma versión que la web
(Actualizar = `git pull` + compilar).

Pruebas del scheduler: `zsh mac/Probar-Scheduler.command` (o en Linux:
`cmake -B build-tests -DEUCL_APP=OFF -DEUCL_TESTS=ON && cmake --build build-tests && ./build-tests/EUCLTests_artefacts/Release/EUCLTests`).
