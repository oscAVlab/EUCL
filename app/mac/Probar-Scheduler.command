#!/bin/zsh
# EUCL (osc[AV]lab) — prueba de precisión del scheduler MIDI en este Mac (no toca la app instalada)
set -e
cd "$(dirname "$0")/.."
cmake -B build-tests -DEUCL_APP=OFF -DEUCL_TESTS=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build-tests --config Release -j "$(sysctl -n hw.ncpu)"
./build-tests/EUCLTests_artefacts/Release/EUCLTests
