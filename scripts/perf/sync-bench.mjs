// Multiplayer sync cost through the real route (app/api/game/route.ts) and the in-memory D1 stand-in, on a simulated clock:
// N players each poll 'sync' every 140 ms (the client's in-round rate), staggered, for S seconds of a round.
// Prints per-request response bytes, stored state bytes, D1 reads/writes and server CPU per request.
//   node scripts/perf/sync-bench.mjs [players=8] [seconds=30]
import {register} from 'node:module';
register('../../tests/route-loader.mjs',import.meta.url);
const players=Number(process.argv[2]||8),seconds=Number(process.argv[3]||30);
let clock=1800000000000;Date.now=()=>clock;
const {db}=await import('../../tests/fake-workers.mjs');db.instant=true;
const {POST}=await import('../../app/api/game/route.ts');
const call=async body=>{const res=await POST(new Request('http://bench/api/game',{method:'POST',body:JSON.stringify(body)}));const text=await res.text();if(res.status!==200)throw new Error(body.action+' '+res.status+' '+text);return{data:JSON.parse(text),bytes:Buffer.byteLength(text)};};
const host=(await call({action:'create',name:'P0'})).data,code=host.room.code,sessions=[{code,id:host.id,token:host.token}];
for(let i=1;i<players;i++){const g=(await call({action:'join',name:'P'+i,code})).data;sessions.push({code,id:g.id,token:g.token});}
await call({action:players>1?'start':'practice',...sessions[0]});
const reads0=db.reads,writes0=db.writes;let requests=0,bytes=0,cpu=0,worst=0,seq=1;
const end=clock+seconds*1000,next=sessions.map((_,i)=>clock+Math.round(i*140/players));
while(true){
 const i=next.indexOf(Math.min(...next));if(next[i]>=end)break;clock=next[i];next[i]+=140;
 const a=clock/2500+i;const t=performance.now();
 const r=await call({action:'sync',...sessions[i],seq:++seq,dx:Math.cos(a),dy:Math.sin(a),sprint:Math.sin(clock/7000+i)>.3});
 const ms=performance.now()-t;cpu+=ms;worst=Math.max(worst,ms);requests++;bytes+=r.bytes;
}
const state=Buffer.byteLength(db.rows.get(code).state);
console.log(JSON.stringify({players,seconds,requests,meanResponseBytes:Math.round(bytes/requests),stateBytes:state,
 readsPerRequest:+((db.reads-reads0)/requests).toFixed(2),writesPerRequest:+((db.writes-writes0)/requests).toFixed(2),
 writesPerSecond:+((db.writes-writes0)/seconds).toFixed(1),downloadKBps:+(bytes/1024/seconds).toFixed(1),
 meanServerMs:+(cpu/requests).toFixed(2),worstServerMs:+worst.toFixed(1)}));
