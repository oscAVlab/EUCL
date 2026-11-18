#!/bin/zsh
# EUCL (osc[AV]lab) — traer la última versión de GitHub (web + app), compilar e instalar
set -e
cd "$(dirname "$0")/.."
osascript -e 'quit app "EUCL"' 2>/dev/null || true
git pull
zsh mac/Compilar.command
