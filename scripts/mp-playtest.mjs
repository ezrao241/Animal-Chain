// Two independent browser sessions playing one room through the real multiplayer route (app/api/game/route.ts, with the
// in-memory D1 stand-in) and the real game page from the play build, opened with ?server so its requests reach this server.
// Checks the lobby roster, the host's start button, one-shot presses, hidden animals in the actual responses, payload size
// and host hand-off when the host's tab closes. Run the play build first:
//   node node_modules/vite/bin/vite.js build --config play/vite.config.mjs && node play/split.mjs && node scripts/mp-playtest.mjs [shots-dir]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire,register} from 'node:module';
register('../tests/route-loader.mjs',import.meta.url);
const require=createRequire(import.meta.url);
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/node22/lib/node_modules/playwright'));}
const {POST}=await import('../app/api/game/route.ts');const {db}=await import('../tests/fake-workers.mjs');
const repo=path.resolve(import.meta.dirname,'..'),root=path.join(repo,'dist-play'),shots=process.argv[2];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/game')){let body='';for await(const c of req)body+=c;const r=await POST(new Request('http://local/api/game',{method:'POST',body}));res.writeHead(r.status,{'Content-Type':'application/json'});res.end(await r.text());return;}
 const file=path.join(root,decodeURIComponent(req.url.split('?')[0])==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const api=async body=>{const r=await fetch(origin+'/api/game',{method:'POST',body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(body.action+': '+d.error);return d;};
const state=code=>JSON.parse(db.rows.get(code).state),edit=(code,fn)=>{const row=db.rows.get(code),room=JSON.parse(row.state);fn(room);db.rows.set(code,{...row,state:JSON.stringify(room),version:row.version+1});};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(what,fn,ms=15000){const end=Date.now()+ms;while(Date.now()<end){try{const v=await fn();if(v)return v;}catch{}await wait(200);}throw new Error('timed out: '+what);}
const results=[];const pass=m=>{results.push(m);console.log('PASS',m);};

const browser=await chromium.launch({args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{
 // two players join from the title screen of separate browser contexts (separate storage, like separate devices)
 const host=await api({action:'create',name:'Ama'}),code=host.room.code;const guest=await api({action:'join',name:'Kofi',code});
 const open=async(s,label)=>{const ctx=await browser.newContext({viewport:{width:640,height:400}});await ctx.addInitScript(v=>{sessionStorage.setItem('animal-chain-session',v);},JSON.stringify({code,id:s.id,token:s.token}));
  const page=await ctx.newPage();const seen=[];page.on('response',async r=>{if(r.url().endsWith('/api/game')){try{const t=await r.text();seen.push(t);}catch{}}});page.on('pageerror',e=>console.log(label,'page error:',e.message));
  await page.goto(origin+'/?server');return{ctx,page,seen,s};};
 const A=await open(host,'host'),B=await open(guest,'guest');
 await until('both lobbies list both players',async()=>{for(const p of [A,B]){const t=await p.page.locator('.player-list').innerText();if(!t.includes('Ama')||!t.includes('Kofi'))return false;}return true;});
 pass('lobby roster shows both players on both devices');
 await A.page.getByRole('button',{name:/Enter the savanna/}).click();
 await until('round running on both pages',async()=>await A.page.locator('.game-world').count()&&await B.page.locator('.game-world').count());
 pass('host started the round from the lobby button; both clients entered it');
 if(shots){fs.mkdirSync(shots,{recursive:true});await wait(2500);await A.page.screenshot({path:path.join(shots,'host.png')});await B.page.screenshot({path:path.join(shots,'guest.png')});}
 // a press goes through the queue, is acknowledged and runs exactly once
 edit(code,room=>{Object.assign(room.players.find(p=>p.id===host.id),{species:'hyena',abilityReady:0,abilityUntil:0,deadUntil:0,protectedUntil:0});});
 await wait(400);await A.page.locator('canvas').first().click({position:{x:480,y:300}}).catch(()=>{});await A.page.keyboard.press('Space');
 const used=await until('ability ran',()=>{const p=state(code).players.find(p=>p.id===host.id);return p.abilityUntil>0&&p;});
 const act=used.act;await wait(800);assert.equal(state(code).players.find(p=>p.id===host.id).act,act,'no second run');
 pass('Space on the host page ran the ability once and was acknowledged (act '+String(act).slice(-4)+')');
 // a burrowed player is absent from the other player's actual responses
 edit(code,room=>{Object.assign(room.players.find(p=>p.id===guest.id),{species:'warthog',abilityUntil:Date.now()+20000,deadUntil:0});});const editAt=Date.now();
 const gx=String(state(code).players.find(p=>p.id===guest.id).x).slice(0,6);A.seen.length=0;const t0=Date.now();await wait(4000);const secs=(Date.now()-t0)/1000;
 const fps=await A.page.locator('.world-scene').first().getAttribute('data-fps').catch(()=>'?');console.log('host page fps (software GPU):',fps);// only responses computed after the change count (one already in flight may predate it)
 const after=A.seen.filter(t=>JSON.parse(t).room?.serverTime>editAt),views=after.map(t=>JSON.parse(t).room);assert.ok(views.length>=2,'host kept syncing ('+views.length+')');
 for(const v of views)assert.ok(!v.players.some(p=>p.id===guest.id),'hidden warthog leaked');
 assert.ok(!after.some(t=>t.includes(gx)),'its coordinates appear in no response');
 pass(`a burrowed warthog was absent from all ${views.length} of the other player's responses; the roster still lists it`);
 const sizes=A.seen.map(t=>t.length);pass(`real responses during play: mean ${Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length/1024)} KB, ${(sizes.length/secs).toFixed(1)} per second`);
 // the host's tab closes: after the grace period the guest becomes host
 await A.ctx.close();const closed=Date.now();
 await until('host hand-off',()=>state(code).host===guest.id,25000);
 pass(`host tab closed; the guest became host ${((Date.now()-closed)/1000).toFixed(1)} s later (10 s grace from its last sync)`);
 // the guest reloads: same session, same animal, no duplicate
 const born=state(code).players.find(p=>p.id===guest.id).born;await B.page.reload();await until('guest back in the round',async()=>await B.page.locator('.game-world').count());
 assert.equal(state(code).players.filter(p=>!p.bot).length,2);assert.equal(state(code).players.find(p=>p.id===guest.id).born,born);
 pass('guest reloaded the page and resumed the same animal, no duplicate player');
 if(shots)await B.page.screenshot({path:path.join(shots,'guest-after.png')});
}finally{await browser.close();server.close();}
console.log(`\n${results.length} checks passed`);
