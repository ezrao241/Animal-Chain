// After the build: binary files the static host won't serve (and its per-file cap) become base64 .partN.txt pieces and tell the page about them
// (api-shim.ts stitches them back together on fetch).
import fs from 'node:fs'; import path from 'node:path';
const out = path.resolve(import.meta.dirname, '../dist-play'), CAP = 11 * 1024 * 1024, split = {};
// files the host serves as-is; everything else (glb, bin, hdr) ships as base64 text pieces
const SERVED = /\.(html|css|js|mjs|wasm|json|map|txt|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp3|wav|ogg|mp4|webm|pdf)$/i;
const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(out)) {
  if (SERVED.test(f)) continue;
  const buf = fs.readFileSync(f), n = Math.ceil(buf.length / CAP);
  for (let i = 0; i < n; i++) fs.writeFileSync(`${f}.part${i}.txt`, buf.subarray(i * CAP, (i + 1) * CAP).toString('base64'));
  fs.unlinkSync(f); split[path.relative(out, f)] = n;
}
console.log('encoded', Object.keys(split).length, 'binary files');
const html = path.join(out, 'index.html');
fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('<head>', `<head>\n<script>window.__ANIMAL_CHAIN_SPLIT=${JSON.stringify(split)}</script>`));

// The static host wraps the page in its own document skeleton and serves fonts next to the page, not at the site root.
for (const f of walk(path.join(out, 'assets')).filter(f => f.endsWith('.css'))) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replaceAll("url('/fonts/", "url('../fonts/").replaceAll('url(/fonts/', 'url(../fonts/'));
const page = fs.readFileSync(html, 'utf8').replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '').replace(/<meta[^>]*>\s*/g, '')
  .replace(/<\/head>\s*<body[^>]*>/i, '<style>html,body{height:100%;background:#0c1814}</style>').replace(/<\/body>\s*<\/html>\s*$/i, '');
fs.writeFileSync(html, page.replace(/^(<script>[^<]*<\/script>\s*)(<title>[^<]*<\/title>\s*)/, '$2$1'));
