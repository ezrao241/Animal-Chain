// Headless check of the in-round sound (lib/savanna-audio.ts) on the solo-practice build (dist-play/, build it first).
//   node scripts/sound-check.mjs [seconds=40] [shots-dir]
// Taps everything the page sends to the speakers into an analyser and prints the output level over a practice round
// (walking, sprinting, standing) as the in-game clock runs, then checks that M mutes it and the sound panel works.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({chromium} = require('playwright')); } catch { ({chromium} = require('/opt/node22/lib/node_modules/playwright')); }
const repo = path.resolve(import.meta.dirname, '..'), root = path.join(repo, 'dist-play');
const seconds = Number(process.argv[2] || 40), shots = process.argv[3];
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(file);
  if (file.endsWith('index.html')) body = `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
  res.writeHead(200, {'Content-Type': {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf'}[path.extname(file)] || 'application/octet-stream'}); res.end(body);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']});
const page = await browser.newPage({viewport: {width: 1280, height: 720}});
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
  try { localStorage.setItem('animal-chain-name', 'Ears'); localStorage.setItem('animal-chain-tutorial', '1'); } catch {}
  const connect = AudioNode.prototype.connect, made = window.__voices = {count: 0};
  const osc = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () { made.count++; return osc.call(this); };
  AudioNode.prototype.connect = function (target, ...rest) {
    if (target instanceof AudioDestinationNode) {
      const ctx = target.context;
      if (!ctx.__tap) { ctx.__tap = ctx.createAnalyser(); ctx.__tap.fftSize = 2048; window.__tap = ctx.__tap; window.__ctx = ctx; }
      connect.call(this, ctx.__tap);
    }
    return connect.call(this, target, ...rest);
  };
});
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.getByPlaceholder('Nickname').fill('Ears');
await page.getByPlaceholder('Nickname').press('Enter');
await page.waitForFunction(() => document.querySelector('.world-scene canvas'), null, {timeout: 30000});
await page.keyboard.press('Escape');
const level = () => page.evaluate(() => {
  const t = window.__tap; if (!t) return {rms: 0, state: 'none'};
  const d = new Float32Array(t.fftSize); t.getFloatTimeDomainData(d); let s = 0; for (const v of d) s += v * v;
  const f = new Float32Array(t.frequencyBinCount); t.getFloatFrequencyData(f);
  const band = (lo, hi) => { const k = window.__ctx.sampleRate / t.fftSize; let m = -200; for (let i = Math.floor(lo / k); i < hi / k; i++) m = Math.max(m, f[i]); return Math.round(m); };
  return {rms: Math.sqrt(s / d.length), state: window.__ctx.state, low: band(40, 400), mid: band(400, 2500), high: band(2500, 8000), voices: window.__voices.count};
});
const clock = () => page.evaluate(() => document.querySelector('.daylight-chip')?.textContent || '');
const keys = [['w'], ['w', 'Shift'], [], ['a'], ['d', 'Shift']];
let quiet = 0, samples = 0;
for (let i = 0; i < seconds; i++) {
  const hold = keys[Math.floor(i / 4) % keys.length];
  for (const k of hold) await page.keyboard.down(k);
  await page.waitForTimeout(1000);
  for (const k of hold) await page.keyboard.up(k);
  const l = await level(); samples++; if (l.rms < 1e-4) quiet++;
  if (i % 4 === 0) console.log(`${String(i).padStart(3)} s  ${(await clock()).slice(0, 28).padEnd(28)} keys=${hold.join('+') || '-'}`.padEnd(64), `rms=${l.rms.toFixed(4)} low=${l.low} mid=${l.mid} high=${l.high} dB oscillators=${l.voices} ${l.state}`);
}
if (shots) { fs.mkdirSync(shots, {recursive: true}); await page.getByLabel(/Sound settings/).click(); await page.waitForTimeout(300); await page.screenshot({path: path.join(shots, 'sound-panel.png')}); await page.getByLabel(/Sound settings/).click(); }
await page.keyboard.press('m'); await page.waitForTimeout(800);
const muted = await level();
await page.keyboard.press('m'); await page.waitForTimeout(1500);
const back = await level();
const saved = await page.evaluate(() => localStorage.getItem('animal-chain-sound'));
console.log(`silent samples ${quiet}/${samples}; muted rms=${muted.rms.toFixed(5)}; unmuted rms=${back.rms.toFixed(4)}; saved ${saved}`);
console.log(errors.length ? 'page errors:\n' + errors.slice(0, 10).join('\n') : 'no page errors');
await browser.close(); server.close();
process.exit(errors.length || muted.rms > 1e-4 || quiet > samples / 4 ? 1 : 0);
