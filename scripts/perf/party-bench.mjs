// A full party on the real route, in real time: N players (default 8, the room maximum) each sync every 140 ms like
// app/page.tsx does (the next request 140 ms after the last was sent), all moving and reporting where their animal got to,
// against the D1 stand-in with a round trip of D1_MS per query. Concurrent requests race on the room's version check, so
// this shows conflicts, retries, "savanna is busy" answers and how long each player waits for an answer.
//   D1_MS=20 node scripts/perf/party-bench.mjs [players=8] [seconds=20]
import {register} from 'node:module';
register('../../tests/route-loader.mjs',import.meta.url);
const players=Number(process.argv[2]||8),seconds=Number(process.argv[3]||20);
const {db}=await import('../../tests/fake-workers.mjs');db.latency=Number(process.env.D1_MS??20);
const {POST}=await import('../../app/api/game/route.ts');
let cpu=0;
const call=async body=>{const t=performance.now();const res=await POST(new Request('http://bench/api/game',{method:'POST',body:JSON.stringify(body)}));const text=await res.text();return{status:res.status,data:JSON.parse(text),bytes:Buffer.byteLength(text),ms:performance.now()-t};};
const host=(await call({action:'create',name:'P0'})).data,code=host.room.code,sessions=[{code,id:host.id,token:host.token}];
for(let i=1;i<players;i++){const g=(await call({action:'join',name:'P'+i,code})).data;sessions.push({code,id:g.id,token:g.token});}
await call({action:players>1?'start':'practice',...sessions[0]});
const reads0=db.reads,writes0=db.writes,conflicts0=db.conflicts,t0=Date.now(),end=t0+seconds*1000;
const waits=[],fail={},bytes=[],gaps=[];let refused=0,advanced=0,lastTick=0;
await Promise.all(sessions.map(async(s,i)=>{
 await new Promise(r=>setTimeout(r,i*140/players));let seq=1,me=null,landed=Date.now();
 while(Date.now()<end){
  const sent=Date.now(),a=Math.round((Math.floor(sent/1200)*2.4+i)%8)*Math.PI/4,dx=Math.cos(a),dy=Math.sin(a);
  // claim a position a walking animal reaches in one poll, the way the client reports its locally moved animal
  const claimAt=me?{x:me.x+dx*2*14,y:me.y+dy*2*14,vx:dx*20,vy:dy*20,born:me.born}:{};
  const r=await call({action:'sync',...s,seq:++seq,dx:+dx.toFixed(3),dy:+dy.toFixed(3),sprint:false,...claimAt});
  waits.push(r.ms);bytes.push(r.bytes);
  if(r.status!==200)fail[r.status]=(fail[r.status]||0)+1;
  else{const p=r.data.room.players.find(p=>p.id===s.id);if(p){if(me&&p.fix&&p.fix!==me.fix)refused++;if(claimAt.x!==undefined&&Math.hypot(p.x-claimAt.x,p.y-claimAt.y)<.5){gaps.push(Date.now()-landed);landed=Date.now();}me=p;}if(r.data.room.tick>lastTick){lastTick=r.data.room.tick;advanced++;}}
  await new Promise(r=>setTimeout(r,Math.max(40,140-(Date.now()-sent))));
 }
}));
waits.sort((a,b)=>a-b);const pct=(a,f)=>{a=[...a].sort((x,y)=>x-y);return a.length?Math.round(a[Math.min(a.length-1,Math.floor(a.length*f))]):null;};const q=f=>+waits[Math.min(waits.length-1,Math.floor(waits.length*f))].toFixed(0),n=waits.length,secs=(Date.now()-t0)/1000;
console.log(JSON.stringify({players,d1Ms:db.latency,requests:n,perPlayerPerSecond:+(n/players/secs).toFixed(2),
 inputLandsPerPlayerPerSecond:+(gaps.length/players/secs).toFixed(2),inputGapMsP95:pct(gaps,.95),inputGapMsMax:pct(gaps,1),waitMsP50:q(.5),waitMsP95:q(.95),waitMsMax:q(.999),failures:fail,refusedClaims:refused,
 writesPerSecond:+((db.writes-writes0)/secs).toFixed(1),conflictsPerSecond:+((db.conflicts-conflicts0)/secs).toFixed(1),
 readsPerRequest:+((db.reads-reads0)/n).toFixed(2),stateKB:+(Buffer.byteLength(db.rows.get(code).state)/1024).toFixed(0),
 downloadKBpsPerPlayer:+(bytes.reduce((a,b)=>a+b,0)/1024/secs/players).toFixed(0)}));
process.exit(0);
