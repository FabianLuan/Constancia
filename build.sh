#!/bin/sh
# Genera public/ (app instalable para Firebase Hosting) y preview.html (vista de prueba sin nube) desde src/
set -e
cd "$(dirname "$0")"
FONTS='<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:wght@400..700&display=swap">'
{ echo '<title>Constancia</title><meta name="claude:viewport-fit-sides" content="cover">'; echo "$FONTS"; echo '<style>'; cat src/app.css; echo '</style>'; cat src/body.html; echo '<script>'; cat src/emoji.js src/app.js; echo '</script>'; } > preview.html
mkdir -p public
{ echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Constancia</title><meta name="description" content="Seguimiento de hábitos"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg"><link rel="apple-touch-icon" href="icon-192.png"><meta name="theme-color" content="#17734A"><meta name="apple-mobile-web-app-capable" content="yes">'; echo "$FONTS"; echo '<style>body{margin:0}[hidden]{display:none!important}'; cat src/app.css; echo '</style></head><body>'; cat src/body.html; echo '<script>'; cat src/emoji.js src/app.js; echo '</script><script type="module" src="sync.js"></script></body></html>'; } > public/index.html
cp src/sw.js src/manifest.webmanifest src/icon.svg public/
[ -f src/icon-192.png ] && cp src/icon-192.png src/icon-512.png public/ || true
