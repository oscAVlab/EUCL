// EUCL app (osc[AV]lab) — ajustes específicos de macOS (WKWebView / App Nap)
#pragma once

namespace eu::mac
{
// Evita que macOS frene la app (App Nap) cuando la ventana queda detrás de Ableton.
void keepAwakeForRealtime();

// Busca el WKWebView dentro de esta NSView y:
//  - desactiva el frenado de timers / supresión de proceso cuando la página no se ve
//  - añade alert() / confirm() / prompt() nativos (WKWebView los ignora por defecto)
//  - habilita "Inspeccionar elemento" (clic derecho) para depurar
// Devuelve true si encontró el WKWebView.
bool tweakWebView (void* nsViewHandle);
}
