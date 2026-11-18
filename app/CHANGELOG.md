# EUCL app — cambios

## v0.1 (2026-11-18)
- Primera versión: web EUCL v2.0 dentro de la app (WKWebView, JUCE 8.0.4).
- MIDI nativo CoreMIDI con puertos virtuales "EUCL" (in/out).
- Scheduler MIDI de tiempo real que respeta los timestamps de la web (notas, clock 24 PPQN, Start/Stop); Stop vacía la cola.
- Reloj externo con instante real de llegada; offset de reloj web⇄nativo sincronizado cada 5 s.
- localStorage (presets LOCAL, sesión NUBE, OFS) copiado en Application Support.
- EXPORT con diálogo de macOS, puertos recordados, enlaces al navegador, fuentes locales.
- Barra superior: versión de app y web, estado del scheduler y precisión medida en vivo.
