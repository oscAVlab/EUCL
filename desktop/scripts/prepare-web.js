// Copia la web de EUCL (raíz del repo) + fuentes + scripts de la app en www/ (lo que se empaqueta)
"use strict";
const fs = require("fs"), path = require("path");
const here = path.join(__dirname, ".."), root = path.join(here, "..");
const www = path.join(here, "www");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
const cp = (src, name) => fs.copyFileSync(src, path.join(www, name || path.basename(src)));
cp(path.join(root, "index.html"));
cp(path.join(root, "assets", "logo-oscavlab.png"));
for (const f of fs.readdirSync(path.join(root, "app", "web", "vendor"))) cp(path.join(root, "app", "web", "vendor", f));
for (const f of fs.readdirSync(path.join(here, "web"))) cp(path.join(here, "web", f));
const html = fs.readFileSync(path.join(www, "index.html"), "utf8");
const v = (html.match(/class="ver">(v[0-9.]+)</) || [])[1] || "?";
fs.writeFileSync(path.join(www, "web-version.txt"), v);
console.log("web " + v + " lista en www/");
