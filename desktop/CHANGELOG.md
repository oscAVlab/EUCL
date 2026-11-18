# EUCL app — cambios

## v0.2 (2026-11-18) — motor Chrome
- La app pasa de Safari/WKWebView (JUCE, `../app/`) a Electron (Chrome 140): el audio de Safari se iba haciendo lento y con glitches.
- Panel **Ajustes de audio y MIDI** (⌘, / botón AUDIO): salida de audio, buffer, frecuencia, latencias; info MIDI y precisión.
- Puertos virtuales EUCL con scheduler de tiempo real en hilo propio (jitter de clock 0,16 ms en prueba).
- Web MIDI nativo de Chrome para hardware; puertos recordados por nombre.

## v0.1.1 / v0.1 — ver ../app/CHANGELOG.md (versión WKWebView)
