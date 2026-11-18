#!/bin/zsh
# EUCL (osc[AV]lab) — traer la última versión de GitHub (web + app), empaquetar e instalar
set -e
cd "$(dirname "$0")/.."
osascript -e 'quit app "EUCL"' 2>/dev/null || true
# Funciona aunque la rama local no tenga upstream (instalación con git init + fetch)
BR="${EUCL_BRANCH:-claude/project-thread-w0vzcd}"
if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  git pull --ff-only
else
  git fetch origin "$BR" && git merge --ff-only FETCH_HEAD
fi
zsh mac/Compilar.command
