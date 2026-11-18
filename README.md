# EUCL · Seq Euclidean x4 — osc[AV]lab

Secuenciador euclídeo de 4 pistas (kick, hihat, mono FM, poly FM) con síntesis WebAudio, MIDI OUT, MIDI clock y matriz de CC. Web: https://oscavlab.github.io/EUCL/ (Chrome/Edge para Web MIDI).

## v2.0 (2026-11-18)
- **MIDI**: notas con timestamp (salen junto al audio, no 120 ms antes); CLK OUT a 24 PPQN reales + Start/Stop; offset MIDI (OFS ms); los burst también salen por MIDI; Stop limpia la cola MIDI.
- **Reloj externo**: arranque correcto desde el primer pulso, ratios ×3/×5 repartidos de forma uniforme, swing también en EXT, Song Position Pointer y Continue, clock thru.
- **Scheduler en Web Worker**: no se frena con la pestaña en segundo plano.
- **Layout de escritorio**: pistas en 2×2 (4 en fila a ≥2300 px) con anillo euclídeo, MIDI de pista en la cabecera, master + FX en una fila; móvil apilado.
- **Marca osc[AV]lab V_2026**: logo oficial, paleta (turquesa #00B3A4), Roboto, firma ž.
- **Presets**: LOCAL (navegador) + NUBE. La nube es de lectura pública y solo la cuenta del dueño puede guardar/renombrar/borrar (ver `supabase/`). EXPORT/IMPORT JSON como copia de seguridad.
- Teclas 1–4: mute de pistas.
