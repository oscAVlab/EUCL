# EUCL para Mac (motor Chrome) — guía rápida

## 1. Instalar (una vez)

```bash
brew install node
cd "$HOME/_LAB/Devices/EUCL/EUCL" && git pull && zsh desktop/mac/Compilar.command
```

La primera vez descarga Electron (1-2 min). Queda en **/Applications/EUCL.app** (sustituye la versión anterior) y se abre sola.

> Si macOS no deja abrirla: clic derecho sobre EUCL.app → Abrir → Abrir (sólo la primera vez).

## 2. Actualizar

```bash
zsh "$HOME/_LAB/Devices/EUCL/EUCL/desktop/mac/Actualizar.command"
```

## 3. Ajustes de audio y MIDI

Menú **EUCL → Ajustes de audio y MIDI…** (⌘,) o botón **AUDIO** junto a los selectores MIDI.

- **Salida**: cualquier interfaz de audio. Cambia al momento. Si salen como "Salida 1, 2…", pulsa *Ver nombres de las salidas*
  (macOS pide permiso de micrófono sólo para dar los nombres; EUCL no graba nada).
- **Buffer**: 128 = mínima latencia; si hay glitches, sube a 256 o 512.
- **Frecuencia**: Auto usa la de la interfaz.
- Buffer y frecuencia se aplican con **Aplicar y recargar** (guarda antes el preset: el patrón en curso se pierde).
- Abajo ves la latencia real y, con MIDI sonando, la precisión del puerto virtual EUCL.

## 4. Con Ableton Live

1. En Ableton → Preferencias → Link/Tempo/MIDI aparecen **EUCL** como entrada y como salida.
2. **EUCL tocando instrumentos de Ableton**: en EUCL, MIDI OUT = `EUCL (virtual)`. En la pista MIDI de Ableton:
   *MIDI From* = `EUCL`, canal = el CH de la pista de EUCL. Activa *Track* en la entrada EUCL.
3. **EUCL maestro de tempo**: CLK OUT = ON y *Sync* en la entrada EUCL de Ableton.
4. **Ableton maestro**: *Sync* en la salida EUCL de Ableton; en EUCL, CTRL IN = `EUCL (virtual)` y modo EXT.
5. Si las notas MIDI van corridas respecto al audio de EUCL, ajusta **OFS** (ms).

Hardware (Model:Cycles, Tetra, Model D…) se elige directamente en MIDI OUT.
