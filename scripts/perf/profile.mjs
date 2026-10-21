// Browser performance profile of the solo-practice build (dist-play/). Builds nothing: run the play build first.
//   node node_modules/vite/bin/vite.js build --config play/vite.config.mjs --minify false && node play/split.mjs
//   node scripts/perf/profile.mjs [seconds=20] [out.json]      (PERF_VIEWPORT=640x360 to change the window size)
// Starts a practice round in headless Chromium (SwiftShader, so absolute GPU numbers are pessimistic), drives the
// animal around with the keyboard, records frame intervals, the scene's own fps/draw-call readouts, and a CPU profile
// of the page's main thread, then prints the functions with the most self time.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({chromium} = require('playwright')); } catch { ({chromium} = require('/opt/node22/lib/node_modules/playwright')); }

const repo = path.resolve(import.meta.dirname, '../..'), root = path.resolve(process.env.PERF_ROOT || path.join(repo, 'dist-play'));
const seconds = Number(process.argv[2] || 20), outFile = process.argv[3];
const [vw, vh] = (process.env.PERF_VIEWPORT || '1280x720').split('x').map(Number);
if (!fs.existsSync(path.join(root, 'index.html'))) { console.error('dist-play/ is missing: run the play build first.'); process.exit(1); }
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf'};
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(file);
  // the published page is wrapped in a document skeleton by the host; do the same here
  if (file.endsWith('index.html')) body = `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
  res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'}); res.end(body);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport: {width: vw, height: vh}});
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(() => { try { localStorage.setItem('animal-chain-name', 'Perf'); } catch {} });
await page.goto(url);
await page.getByPlaceholder('Enter a nickname').fill('Perf');
await page.getByText('Create a room').click();
await page.locator('.practice-button').click();
await page.waitForFunction(() => document.querySelector('.world-scene canvas'), null, {timeout: 30000});
await page.waitForTimeout(3000);

// frame intervals as the page sees them (requestAnimationFrame), plus long tasks
await page.evaluate(() => {
  const w = window; w.__frames = []; w.__long = [];
  let last = performance.now();
  const loop = t => { w.__frames.push(t - last); last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) w.__long.push(e.duration); }).observe({type: 'longtask', buffered: false}); } catch {}
});
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 200}); await cdp.send('Profiler.start');
const canvas = page.locator('.world-scene canvas').first(); await canvas.focus();
// a fixed route: run, sprint, turn, so the camera sweeps across the plains and the LOD and grass chunks change
const keys = ['w', 'w', 'd', 'w', 'a', 'w', 's', 'w'];
const started = Date.now();
for (let i = 0; Date.now() - started < seconds * 1000; i++) {
  const k = keys[i % keys.length]; await page.keyboard.down(k); if (i % 3 === 0) await page.keyboard.down('Shift');
  await page.waitForTimeout(1200); await page.keyboard.up(k); await page.keyboard.up('Shift');
}
const {profile} = await cdp.send('Profiler.stop');
const stats = await page.evaluate(() => {
  const f = window.__frames.slice(5).sort((a, b) => a - b), el = document.querySelector('.world-scene');
  const pct = q => f[Math.min(f.length - 1, Math.floor(f.length * q))];
  return {frames: f.length, meanMs: f.reduce((s, x) => s + x, 0) / f.length, p50: pct(.5), p95: pct(.95), p99: pct(.99), max: f.at(-1),
    longTasks: window.__long.length, longTaskMs: window.__long.reduce((s, x) => s + x, 0),
    sceneFps: Number(el?.dataset.fps), sceneRenderMs: Number(el?.dataset.renderMs), drawCalls: Number(el?.dataset.drawCalls), triangles: Number(el?.dataset.triangles),
    animalDrawCalls: Number(el?.dataset.animalDrawCalls), quality: el?.dataset.quality, renderer: el?.dataset.renderer,
    heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null};
});
await browser.close(); server.close();

// self time per function, from the sampled profile
const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map();
const dts = profile.timeDeltas; let total = 0;
profile.samples.forEach((id, i) => { const n = byId.get(id), cf = n.callFrame, dt = (dts[i] || 0) / 1000;
  const key = `${cf.functionName || '(anonymous)'} ${cf.url ? path.basename(cf.url) + ':' + (cf.lineNumber + 1) : ''}`.trim();
  self.set(key, (self.get(key) || 0) + dt); total += dt; });
const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, ms]) => ({fn: k, ms: Math.round(ms), pct: Math.round(ms / total * 1000) / 10}));
const result = {seconds, stats, profileMs: Math.round(total), top, errors};
console.log(JSON.stringify(stats, null, 1));
console.table(top);
if (errors.length) console.log('page errors:', errors);
if (outFile) fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
