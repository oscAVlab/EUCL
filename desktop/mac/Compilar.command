#!/bin/zsh
# EUCL (osc[AV]lab) — app de escritorio con motor Chrome: preparar, empaquetar e instalar en /Applications
# Requisito (una vez): brew install node
set -e
cd "$(dirname "$0")/.."
command -v npm >/dev/null || { echo "Falta Node.js. Instálalo con:  brew install node"; exit 1; }
echo "== EUCL: dependencias (la primera vez descarga Electron, ~1-2 min) =="
npm install --no-audit --no-fund
echo "== copiando la web =="
node scripts/prepare-web.js
echo "== icono =="
rm -rf build && mkdir -p build/icon.iconset
for s in 16 32 128 256 512; do
  sips -z $s $s ../app/assets/icon.png --out build/icon.iconset/icon_${s}x${s}.png >/dev/null
  sips -z $((s*2)) $((s*2)) ../app/assets/icon.png --out build/icon.iconset/icon_${s}x${s}@2x.png >/dev/null
done
iconutil -c icns build/icon.iconset -o build/icon.icns
ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && ARCH=x64
VER=$(node -p "require('./package.json').version")
echo "== empaquetando EUCL $VER ($ARCH) =="
npx electron-packager . EUCL --platform=darwin --arch=$ARCH --out=dist --overwrite \
  --icon=build/icon.icns --app-bundle-id=com.oscavlab.eucl --app-version=$VER \
  --app-category-type=public.app-category.music --extend-info=mac/Info-extra.plist \
  --ignore='^/dist' --ignore='^/build' --ignore='^/tests' --ignore='^/docs' --ignore='^/mac' --ignore='^/web' --ignore='^/scripts'
APP="dist/EUCL-darwin-$ARCH/EUCL.app"
codesign --force --deep -s - "$APP" 2>/dev/null || true
echo "== instalando en /Applications =="
osascript -e 'quit app "EUCL"' 2>/dev/null || true
sleep 1
rm -rf "/Applications/EUCL.app"
ditto "$APP" "/Applications/EUCL.app"
xattr -cr "/Applications/EUCL.app" 2>/dev/null || true
echo "Listo. Abriendo EUCL..."
open "/Applications/EUCL.app"
