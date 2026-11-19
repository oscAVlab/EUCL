# EUCL para Mac — guía rápida

## 1. Instalar (una vez)

Requisitos: herramientas de Xcode y CMake.

```bash
xcode-select --install
brew install cmake
```

Descargar y compilar (tarda 2-4 min la primera vez porque baja JUCE):

```bash
git clone -b claude/project-thread-w0vzcd https://github.com/oscAVlab/EUCL.git "$HOME/_LAB/Devices/EUCL" && zsh "$HOME/_LAB/Devices/EUCL/app/mac/Compilar.command"
```

Queda instalada en **/Applications/EUCL.app** y se abre sola.

> Si macOS dice que no puede verificar la app: clic derecho sobre EUCL.app → Abrir → Abrir (sólo la primera vez).

## 2. Actualizar

```bash
zsh "$HOME/_LAB/Devices/EUCL/app/mac/Actualizar.command"
```

Trae de GitHub la última web y la última app, compila e instala.

## 3. Con Ableton Live

1. Abre EUCL. En Ableton → Preferencias → Link/Tempo/MIDI aparecen **EUCL** como entrada y como salida.
2. **EUCL tocando instrumentos de Ableton**: en EUCL, MIDI OUT = `EUCL (virtual)`. En Ableton, en la pista MIDI:
   *MIDI From* = `EUCL`, canal = el CH de cada pista de EUCL (T1…T4). Activa *Track* en la entrada EUCL.
3. **EUCL como maestro de tempo**: botón CLK OUT = ON. En Ableton activa *Sync* en la entrada EUCL.
4. **Ableton como maestro**: en Ableton activa *Sync* en la salida EUCL; en EUCL, CTRL IN = `EUCL (virtual)` y modo EXT.
5. Si oyes las notas MIDI corridas respecto al audio de EUCL, ajusta **OFS** (ms).

También puedes elegir directamente hardware (Model:Cycles, Tetra, Model D…) en MIDI OUT: el timing es el mismo.

## 4. Qué cambia respecto a la web

| | Web (Chrome) | App |
|---|---|---|
| MIDI | Web MIDI | CoreMIDI nativo + puertos virtuales EUCL |
| Timing | depende del navegador | scheduler de tiempo real (< 1 ms) |
| En segundo plano | puede frenarse | no se frena |
| Presets LOCAL | en el navegador | en la app (+ copia en `~/Library/Application Support/osc[AV]lab/`) |
| EXPORT | descarga | diálogo Guardar de macOS |
| Puertos | hay que elegirlos cada vez | se recuerdan |

La barra superior muestra la versión de la app y de la web, y la precisión real del MIDI mientras suena
(por ejemplo `precisión 0.05 ms (máx 0.30)`).

## 5. Comprobar el timing en tu Mac (opcional)

```bash
zsh "$HOME/_LAB/Devices/EUCL/app/mac/Probar-Scheduler.command"
```

Debe terminar con **TODO OK**.
