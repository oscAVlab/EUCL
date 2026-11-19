#!/bin/zsh
# EUCL (osc[AV]lab) — compilar la app e instalarla en /Applications
# Requisitos (una vez): xcode-select --install ; brew install cmake
set -e
cd "$(dirname "$0")/.."
echo "== EUCL: configurando (la primera vez descarga JUCE, 1-2 min) =="
cmake -B build -DCMAKE_BUILD_TYPE=Release
echo "== compilando =="
cmake --build build --config Release -j "$(sysctl -n hw.ncpu)"
APP="build/EUCL_artefacts/Release/EUCL.app"
echo "== instalando en /Applications =="
osascript -e 'quit app "EUCL"' 2>/dev/null || true
rm -rf "/Applications/EUCL.app"
ditto "$APP" "/Applications/EUCL.app"
echo "Listo. Abriendo EUCL..."
open "/Applications/EUCL.app"
