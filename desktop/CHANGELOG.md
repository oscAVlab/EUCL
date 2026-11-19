# EUCL app — cambios

## v0.2.1 — 2026-11-18
- MIDI nativo (CoreMIDI) para todo: además del puerto virtual EUCL aparecen todas las salidas y entradas del Mac (interfaces, IAC, Ableton, Maschine…). Antes solo se veía el virtual porque dependía del Web MIDI de Chrome.
- Las salidas físicas también van por el scheduler de tiempo real (misma precisión que el virtual).
- Puertos que se conectan o desconectan aparecen solos (cada 2 s).
- Web v2.2: sidechain KICK o FANTASMA (1/1, 1/2, 1/4), filtro de master 24 dB, OUTPUT del saturador, salas con DECAY y PRE (Room 1 s, Hall 3,5 s, Cathedral 8 s hasta 20 s), TIME del delay con snap a subdivisiones, bitcrusher nuevo (BITS/RATE/MIX), kick con SW REL/SW AMT, CLICK, C.TONE y sub-capa RUMBLE.

## v0.2 (2026-11-18) — motor Chrome
- La app pasa de Safari/WKWebView (JUCE, `../app/`) a Electron (Chrome 140): el audio de Safari se iba haciendo lento y con glitches.
- Panel **Ajustes de audio y MIDI** (⌘, / botón AUDIO): salida de audio, buffer, frecuencia, latencias; info MIDI y precisión.
- Puertos virtuales EUCL con scheduler de tiempo real en hilo propio (jitter de clock 0,16 ms en prueba).
- Web MIDI nativo de Chrome para hardware; puertos recordados por nombre.

## v0.1.1 / v0.1 — ver ../app/CHANGELOG.md (versión WKWebView)
