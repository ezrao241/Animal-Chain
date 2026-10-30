// Snap-back check on a slow connection: two browser sessions play one room through the real multiplayer route (as in
// scripts/mp-playtest.mjs) with every /api/game answer delayed by LAG_MS ± JITTER_MS. The host runs straight ahead, then
// turns round, while the page's own-animal position (the .world-scene element's data-own, ~10 Hz) is sampled. Counts
// snap-backs: extra back-and-forth reversals along the line of the run.
//   node node_modules/vite/bin/vite.js build --config play/vite.config.mjs && node play/split.mjs
//   LAG_MS=250 JITTER_MS=120 node scripts/perf/lag-test.mjs [dist-play root]
// LOSS_PCT=10 never answers that share of game requests (the page has to give up on them and resend), as bad Wi-Fi does.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire,register} from 'node:module';
register('../../tests/route-loader.mjs',import.meta.url);
const require=createRequire(import.meta.url);
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}
const {POST}=await import('../../app/api/game/route.ts');const {db}=await import('../../tests/fake-workers.mjs');
const repo=path.resolve(import.meta.dirname,'../..'),root=path.resolve(process.argv[2]||path.join(repo,'dist-play'));
const LAG=Number(process.env.LAG_MS??250),JITTER=Number(process.env.JITTER_MS??120),LOSS=Number(process.env.LOSS_PCT??0)/100;
const wire={syncs:0,lost:0,lite:0,bytes:0,longestGapMs:0,last:0};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let hostId='';
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/game')){let body='';for await(const c of req)body+=c;
  // half the delay on the way in (the server sees the request late), half on the way out
  const leg=()=>wait(Math.max(0,(LAG+(Math.random()*2-1)*JITTER)/2));await leg();
  const sync=JSON.parse(body).action==='sync'&&JSON.parse(body).id===hostId;
  if(sync&&Math.random()<LOSS){wire.lost++;return;}// dropped: no answer ever comes
  const r=await POST(new Request('http://local/api/game',{method:'POST',body}));const text=await r.text();await leg();
  if(sync&&r.ok){const t=Date.now();if(wire.last)wire.longestGapMs=Math.max(wire.longestGapMs,t-wire.last);wire.last=t;wire.syncs++;wire.bytes+=text.length;if(JSON.parse(body).lite)wire.lite++;}
  res.writeHead(r.status,{'Content-Type':'application/json'});res.end(text);return;}
 const file=path.join(root,decodeURIComponent(req.url.split('?')[0])==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const api=async body=>{const r=await fetch(origin+'/api/game',{method:'POST',body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(body.action+': '+d.error);return d;};
const state=code=>JSON.parse(db.rows.get(code).state),edit=(code,fn)=>{const row=db.rows.get(code),room=JSON.parse(row.state);fn(room);db.rows.set(code,{...row,state:JSON.stringify(room),version:row.version+1});};
const browser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
 const host=await api({action:'create',name:'Ama'}),code=host.room.code;hostId=host.id;const guest=await api({action:'join',name:'Kofi',code});
 const open=async s=>{const ctx=await browser.newContext({viewport:{width:480,height:300}});await ctx.addInitScript(v=>{sessionStorage.setItem('animal-chain-session',v);},JSON.stringify({code,id:s.id,token:s.token}));
  const page=await ctx.newPage();await page.goto(origin+'/?server');return page;};
 const A=await open(host),B=await open(guest);
 await A.getByRole('button',{name:/Enter the savanna/}).waitFor({timeout:30000});await A.getByRole('button',{name:/Enter the savanna/}).click();
 await A.locator('.game-world').waitFor({timeout:30000});await B.locator('.game-world').waitFor({timeout:30000});
 // a zebra on open ground, nothing hunting it, so the run is never interrupted
 edit(code,room=>{const me=room.players.find(p=>p.id===host.id);Object.assign(me,{species:'zebra',x:2000,y:1400,vx:0,vy:0,protectedUntil:Date.now()+120000,deadUntil:0,stunUntil:0,climb:'',perched:false,hunger:100,thirst:100});
  for(const p of room.players)if(p.id!==host.id&&Math.hypot(p.x-2000,p.y-1400)<900)p.x=p.x<2000?150:3850;});
 await wait(2500);
 const own=async()=>{const v=await A.locator('.world-scene').first().getAttribute('data-own');if(!v)return null;const [x,y]=v.split(' ').map(Number);return{x,y,t:Date.now()};};
 const samples=[];let phase='';const sampler=(async()=>{while(phase!=='done'){const s=await own(),sv=state(code).players.find(p=>p.id===host.id);if(s)samples.push({...s,phase,sx:sv.x,sy:sv.y});await wait(40);}})();
 await A.locator('canvas').first().click({position:{x:240,y:150}}).catch(()=>{});
 Object.assign(wire,{syncs:0,lost:0,lite:0,bytes:0,longestGapMs:0,last:0});const began=Date.now();
 phase='run';await A.keyboard.down('w');await A.keyboard.down('Shift');await wait(5000);await A.keyboard.up('Shift');
 phase='turn';await A.keyboard.up('w');await A.keyboard.down('s');await wait(3000);await A.keyboard.up('s');
 phase='stop';await wait(1500);phase='done';await sampler;
 // Along the line of the run, a smooth run never changes direction and a smooth turn-round changes it once (it brakes,
 // then runs back); every extra reversal is the animal being pulled back and forth: a snap-back.
 const run=samples.filter(q=>q.phase==='run'),ax=run.at(-1).x-run[0].x,ay=run.at(-1).y-run[0].y,an=Math.hypot(ax,ay)||1,report={};
 for(const [ph,expected] of [['run',0],['turn',1],['stop',0]]){const s=samples.filter(q=>q.phase===ph);if(s.length<3)continue;
  const flips=(xs,ys)=>{let n=0,sign=0,worst=0;for(let i=1;i<xs.length;i++){const step=((xs[i]-xs[i-1])*ax+(ys[i]-ys[i-1])*ay)/an;if(Math.abs(step)<3)continue;const now=Math.sign(step);if(sign&&now!==sign){n++;worst=Math.max(worst,Math.abs(step));}sign=now;}return[Math.max(0,n-expected),+(worst/10).toFixed(1)];};
  // the server's copy is what every other player sees of this animal
  const [snapBacks,largest]=flips(s.map(q=>q.x),s.map(q=>q.y)),[serverSnapBacks]=flips(s.map(q=>q.sx),s.map(q=>q.sy));
  report[ph]={samples:s.length,metres:+(Math.hypot(s.at(-1).x-s[0].x,s.at(-1).y-s[0].y)/10).toFixed(1),serverMetres:+(Math.hypot(s.at(-1).sx-s[0].sx,s.at(-1).sy-s[0].sy)/10).toFixed(1),snapBacks,largestReversalMetres:largest,serverSnapBacks};}
 const fps=await A.locator('.world-scene').first().getAttribute('data-fps').catch(()=>'?');
 const me=state(code).players.find(p=>p.id===host.id),secs=(Date.now()-began)/1000,chip=await A.locator('.connection').first().textContent().catch(()=>'?');
 console.log(JSON.stringify({lagMs:LAG,jitterMs:JITTER,lossPct:LOSS*100,fps,...report,refusedReports:me.fix??0,
  hostSyncsPerSecond:+(wire.syncs/secs).toFixed(1),hostKBps:+(wire.bytes/1024/secs).toFixed(1),meanSyncBytes:Math.round(wire.bytes/Math.max(1,wire.syncs)),liteShare:+(wire.lite/Math.max(1,wire.syncs)).toFixed(2),droppedSyncs:wire.lost,longestGapMs:wire.longestGapMs,connectionChip:chip},null,1));
}finally{await browser.close();server.close();}
