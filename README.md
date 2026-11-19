# EUCL · Seq Euclidean x4 — osc[AV]lab

Secuenciador euclídeo de 4 pistas (kick, hihat, mono FM, poly FM) con síntesis WebAudio, MIDI OUT, MIDI clock y matriz de CC. Web: https://oscavlab.github.io/EUCL/ (Chrome/Edge para Web MIDI).

**App para Mac v0.2** (motor Chrome: ajustes de salida de audio y buffer, puertos virtuales "EUCL", timing de tiempo real): ver [desktop/](desktop/README.md) y la [guía](desktop/docs/GUIA.md). La versión anterior con Safari/WKWebView queda en [app/](app/README.md).

## v2.5 (2026-11-19)
- Casilla «CARGAR MOD» en presets: si está desmarcada, cambiar de preset conserva la matriz MOD actual.
- Colores de pista: T1 ámbar, T2 oliva, T3 pino, T4 verde fosforescente.
- Perillas rediseñadas (tapa con sombra, raya indicadora, puntos de mín/máx) y divisores entre secciones más marcados.
- Meters en cada retorno (room/hall/cathedral/delay) y a la salida del COMP bus; meters de canal más altos.

## v2.4 (2026-11-19)
- PISTAS: retornos (room/hall/cathedral/delay), COMP bus y MASTER en una columna a la derecha de las pistas; todo en una pantalla a 1920×1080.
- La pestaña 2 queda solo para MOD (matriz CC + referencia).
- Menos huecos: el instrumento ocupa el ancho que queda y sus controles fluyen en filas.

## v2.3 (2026-11-19)
- **Pestañas**: PISTAS (cada pista en una fila tipo rack: anillo + MIDI · SECUENCIA · INSTRUMENTO · MEZCLA) y FX · MASTER · MOD (retornos, comp bus, master, matriz CC abierta, referencia). A 1920×1080 todo cabe sin scroll.
- MIDI (CTRL IN, MOD IN, OUT, OFS, ↻) en la barra de pestañas, con aviso si el navegador no tiene MIDI o no hay dispositivos.
- MASTER level + medidor en la cabecera.

## v2.1 (2026-11-18)
- **Ruteo revisado**: canal = HP → LP → CRUSH → PAN → LEVEL (+mute/solo como ganancia) → MASTER o COMP BUS; envíos post-fader a ROOM / HALL / CATHEDRAL / DELAY.
- **Sidechain real**: el compresor del COMP BUS usa el kick solo como llave (AudioWorklet); antes el kick se mezclaba dentro del bus y sonaba duplicado (+6 dB de makeup).
- **Limitador real** en el master (drive 0…+12 dB contra techo de -0,3 dBFS); antes solo bajaba el volumen.
- Presets y morph guardan/interpolan LEVEL, PAN, HP, LP, salida y envíos de cada pista.
- **Perillas** en todos los controles (arrastrar ↕, Shift fino, rueda, doble clic = valor por defecto); punto ámbar = valor modulado por CC.
- Medidores por pista y master, medidor de reducción (GR) del COMP BUS; panel de bus tipo rack.
- Hihat sin crear un buffer de ruido por golpe (menos CPU); SIZE de reverb sin regenerar en cada movimiento.

## v2.0 (2026-11-18)
- **MIDI**: notas con timestamp (salen junto al audio, no 120 ms antes); CLK OUT a 24 PPQN reales + Start/Stop; offset MIDI (OFS ms); los burst también salen por MIDI; Stop limpia la cola MIDI.
- **Reloj externo**: arranque correcto desde el primer pulso, ratios ×3/×5 repartidos de forma uniforme, swing también en EXT, Song Position Pointer y Continue, clock thru.
- **Scheduler en Web Worker**: no se frena con la pestaña en segundo plano.
- **Layout de escritorio**: pistas en 2×2 (4 en fila a ≥2300 px) con anillo euclídeo, MIDI de pista en la cabecera, master + FX en una fila; móvil apilado.
- **Marca osc[AV]lab V_2026**: logo oficial, paleta (turquesa #00B3A4), Roboto, firma ž.
- **Presets**: LOCAL (navegador) + NUBE. La nube es de lectura pública y solo la cuenta del dueño puede guardar/renombrar/borrar (ver `supabase/`). EXPORT/IMPORT JSON como copia de seguridad.
- Teclas 1–4: mute de pistas.
