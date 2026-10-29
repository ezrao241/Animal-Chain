// The authoritative multiplayer handler (app/api/game/route.ts) with an in-memory database: simultaneous requests,
// late or repeated input, a predator and prey player meeting, respawns, host succession, one-shot actions, what each
// player is allowed to see, and no token leaks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
const STRIKE_WINDUP=250,wait=ms=>new Promise(r=>setTimeout(r,ms));
register('./route-loader.mjs',import.meta.url);
const {POST}=await import('../app/api/game/route.ts');
const {db}=await import('./fake-workers.mjs');
const call=async(body,expected=200)=>{const res=await POST(new Request('http://test/api/game',{method:'POST',body:JSON.stringify(body)}));const data=await res.json();assert.equal(res.status,expected,body.action+': '+(data.error||''));return data;};
const auth=d=>({code:d.room.code,id:d.id,token:d.token});
const state=code=>JSON.parse(db.rows.get(code).state);
const save=(code,room)=>{const row=db.rows.get(code);db.rows.set(code,{...row,state:JSON.stringify(room),version:row.version+1});};
const edit=(code,fn)=>{const room=state(code);fn(room);save(code,room);return room;};
const find=(room,id)=>room.players.find(p=>p.id===id);
let aid=1;const press=(kind,born)=>[{id:++aid,kind,born,age:0}];
const {props,solidNear,nearWater,hidden}=await import('../lib/game.ts');
// a patch of open ground (no thicket to hide a still animal, no trunk or boulder, no water) for scripted encounters, so they
// don't depend on where the round happened to spawn the players
function openGround(){const ps=props(417);for(let y=400;y<2400;y+=37)for(let x=400;x<3600;x+=53){const still={species:'impala',x,y,dx:0,dy:0,vx:0,vy:0};
 if(!solidNear(ps,x,y,90).length&&!nearWater(ps,x,y,80)&&!hidden(still,{seed:417},0)&&!hidden({...still,x:x+12},{seed:417},0))return{x,y};}throw new Error('no open ground');}
const meet=room=>(L,I)=>{const g=openGround();Object.assign(L,{x:g.x,y:g.y});Object.assign(I,{x:g.x+12,y:g.y});for(const p of room.players)if(p.bot&&Math.hypot(p.x-g.x,p.y-g.y)<200)p.x=(p.x+1500)%3900+50;};
async function lobby(n){const host=await call({action:'create',name:'Host'});const guests=[];for(let i=1;i<n;i++)guests.push(await call({action:'join',name:'Guest'+i,code:host.room.code}));return{host,guests,code:host.room.code};}

test('two players: start, simultaneous syncs, stale input, an encounter and a respawn stay consistent',async()=>{
 const {host,guests:[guest],code}=await lobby(2);
 await call({action:'start',...auth(guest)},403);
 const started=await call({action:'start',...auth(host)});assert.equal(state(code).players.length,62);assert.equal(started.room.roster.length,2);assert.ok(started.room.players.every(p=>!('token' in p)));
 // 20 rounds of both players syncing at the same moment: every write lands (retries absorb version conflicts)
 let seq=1000;for(let i=0;i<20;i++)await Promise.all([call({action:'sync',...auth(host),seq:++seq,dx:1,dy:0}),call({action:'sync',...auth(guest),seq:++seq,dx:0,dy:1})]);
 assert.ok(db.conflicts>0,'the test really interleaved writes');
 const r=state(code);assert.equal(r.players.filter(p=>!p.bot).length,2);
 // a late packet (older seq) and a repeated packet must not override newer input
 await call({action:'sync',...auth(host),seq:5000,dx:-1,dy:0});await call({action:'sync',...auth(host),seq:4000,dx:1,dy:0});await call({action:'sync',...auth(host),seq:5000,dx:0,dy:1});
 const h=find(state(code),host.id);assert.equal(h.dx,-1);assert.equal(h.seq,5000);
 // predator meets prey: make the host a lion facing an impala guest right in front of it, both unprotected. The impala is
 // taken out of the guest's species bag as if it had been dealt, so the respawn below can't legitimately deal it again.
 const room=edit(code,room=>{const L=find(room,host.id),I=find(room,guest.id);
  Object.assign(L,{species:'lion',protectedUntil:0,deadUntil:0,heading:0,vx:0,vy:0,dx:0,dy:0,abilityUntil:0,climb:''});Object.assign(I,{species:'impala',protectedUntil:0,deadUntil:0,x:L.x+12,y:L.y,vx:0,vy:0,abilityUntil:0,bag:(I.bag||[]).filter(s=>s!=='impala')});
  meet(room)(L,I);});
 const lionBorn=find(room,host.id).born;
 await Promise.all([call({action:'sync',...auth(host),seq:6000,dx:0,dy:0,actions:press('interact',lionBorn)}),call({action:'sync',...auth(guest),seq:6001,dx:0,dy:0})]);
 // the lunge lands a quarter of a second after the press
 await wait(STRIKE_WINDUP+60);const [a,b]=await Promise.all([call({action:'sync',...auth(host),seq:6002,dx:0,dy:0}),call({action:'sync',...auth(guest),seq:6003,dx:0,dy:0})]);
 for(const view of [a.room,b.room]){const lion=find(view,host.id),imp=find(view,guest.id);if(lion?.hunts){assert.ok(imp.deadUntil,'both views agree the impala was caught');}}
 const after=state(code);assert.equal(find(after,host.id).hunts,1);const dead=find(after,guest.id);assert.ok(dead.deadUntil);assert.ok(after.foods.some(f=>f.kind==='carrion'&&f.until),'a carcass was left');
 // input from the dead player is harmless, and after the timer it respawns as a different animal with points kept
 edit(code,room=>{find(room,guest.id).deadUntil=Date.now()-1;});
 const back=await call({action:'sync',...auth(guest),seq:7000,dx:1,dy:0});const g=find(back.room,guest.id);assert.equal(g.deadUntil,0);assert.notEqual(g.species,'impala');
 // restart (new life) and leaving hand the room to the guest
 const restarted=await call({action:'restart',...auth(host)});assert.ok(find(restarted.room,host.id).deadUntil);
 const left=await call({action:'leave',...auth(host)});assert.equal(left.room.host,guest.id);
 await call({action:'sync',...auth(host),seq:9000},401);
 await call({action:'sync',code,id:'wild-1',token:'x',seq:1},401);
});

test('solo practice room: one player and the full wildlife',async()=>{
 const host=await call({action:'create',name:'Solo'});const solo=await call({action:'practice',...auth(host)});assert.equal(solo.room.practice,true);assert.equal(state(host.room.code).players.length,61);
});

test('an away host hands the lobby to an online player after the grace period, not before',async()=>{
 const {host,guests:[g1,g2],code}=await lobby(3);
 // host went quiet 5 s ago: still within the grace period, so nobody else may start
 edit(code,room=>{find(room,host.id).lastSeen=Date.now()-5000;});
 let view=(await call({action:'sync',...auth(g1)})).room;assert.equal(view.host,host.id);
 await call({action:'start',...auth(g1)},403);
 // 12 s: still inside the 15 s grace, so a reload would get the room back
 edit(code,room=>{find(room,host.id).lastSeen=Date.now()-12000;});
 view=(await call({action:'sync',...auth(g2)})).room;assert.equal(view.host,host.id);
 const again=await call({action:'join',...auth(host),name:'Host'});assert.equal(again.id,host.id);assert.equal(again.room.host,host.id);assert.equal(state(code).players.filter(p=>!p.bot).length,3);
 // 16 s quiet: past the grace period the host is removed and the earliest-joined online player takes over and can start
 edit(code,room=>{find(room,host.id).lastSeen=Date.now()-16000;});
 view=(await call({action:'sync',...auth(g2)})).room;assert.equal(view.host,g1.id);assert.equal(view.roster.length,2);
 await call({action:'sync',...auth(host)},401);
 const started=await call({action:'start',...auth(g1)});assert.equal(started.room.phase,'playing');assert.equal(started.room.roster.length,2);assert.equal(state(code).players.length,62,'two players still get the full 60 wildlife');
});

test('a host removed as stale is replaced; a reconnecting player keeps their animal; repeated starts make one round',async()=>{
 const {host,guests:[guest],code}=await lobby(2);
 // the host has been gone long enough to be dropped from the lobby entirely
 edit(code,room=>{find(room,host.id).lastSeen=Date.now()-120000;});
 const view=(await call({action:'sync',...auth(guest)})).room;assert.equal(view.host,guest.id);assert.equal(view.roster.length,1);
 await call({action:'sync',...auth(host)},401);
 // a reconnect with a valid session (a reload, a second join click) gets the same player back, not a second animal
 const other=await call({action:'join',name:'Other',code});const rejoin=await call({action:'join',name:'Other',code,id:other.id,token:other.token});
 assert.equal(rejoin.id,other.id);assert.equal(state(code).players.filter(p=>!p.bot).length,2);
 // double click on start: one round, both requests succeed
 const [a,b]=await Promise.all([call({action:'start',...auth(guest)}),call({action:'start',...auth(guest)})]);
 assert.equal(a.room.round,1);assert.equal(b.room.round,1);assert.equal(state(code).round,1);
});

test('the last human leaving deletes the room; idle rooms expire',async()=>{
 const host=await call({action:'create',name:'Alone'});const code=host.room.code;
 await call({action:'leave',...auth(host)});assert.equal(db.rows.has(code),false);
 const old=await call({action:'create',name:'Old'});const row=db.rows.get(old.room.code);db.rows.set(old.room.code,{...row,updated:Date.now()-31*60000});
 await call({action:'sync',...auth(old)},404);
 await call({action:'create',name:'Sweeper'});assert.equal(db.rows.has(old.room.code),false,'idle rooms are swept on create');
});

test('one-shot actions run once: retries, reordering, earlier lives and old presses are dropped',async()=>{
 const host=await call({action:'create',name:'Solo'});const code=host.room.code;await call({action:'practice',...auth(host)});
 const reset=()=>edit(code,room=>{Object.assign(find(room,host.id),{species:'lion',abilityReady:0,abilityUntil:0,deadUntil:0,climb:''});});
 let born=find(reset(),host.id).born;
 const first=press('ability',born);
 await call({action:'sync',...auth(host),seq:10,actions:first});assert.ok(find(state(code),host.id).abilityUntil>0,'the press ran');
 // the same press retried (the first response was lost): acknowledged, not run again
 reset();const retried=await call({action:'sync',...auth(host),seq:11,actions:first});assert.equal(find(state(code),host.id).abilityUntil,0);
 assert.equal(find(retried.room,host.id).act,first[0].id,'the client is told which presses were processed');
 // a press made in an earlier life (before a respawn) never acts on the new animal
 reset();await call({action:'sync',...auth(host),seq:12,actions:press('ability',born-1)});assert.equal(find(state(code),host.id).abilityUntil,0);
 // a press queued through a long outage is dropped rather than replayed seconds late
 reset();await call({action:'sync',...auth(host),seq:13,actions:[{id:++aid,kind:'ability',born,age:5000}]});assert.equal(find(state(code),host.id).abilityUntil,0);
 // a newer packet carrying two presses, then the older packet arriving late: each press runs once
 reset();const p1=press('ability',born),p2=press('interact',born);
 await call({action:'sync',...auth(host),seq:15,actions:[...p1,...p2]});const after=find(state(code),host.id);assert.ok(after.abilityUntil>0);assert.equal(after.act,p2[0].id);
 reset();await call({action:'sync',...auth(host),seq:14,actions:p1});assert.equal(find(state(code),host.id).abilityUntil,0);
 // dead: the press is acknowledged and dropped
 edit(code,room=>{Object.assign(find(room,host.id),{abilityReady:0,abilityUntil:0,deadUntil:Date.now()+60000});});
 await call({action:'sync',...auth(host),seq:16,actions:press('ability',born)});assert.equal(find(state(code),host.id).abilityUntil,0);
});

test('hidden animals, AI plans and other players\' private fields never reach other clients',async()=>{
 const {host,guests:[guest],code}=await lobby(2);await call({action:'start',...auth(host)});
 // the guest is a warthog down a burrow: hidden from everyone else
 edit(code,room=>{Object.assign(find(room,guest.id),{species:'warthog',abilityUntil:Date.now()+60000,deadUntil:0});});
 const res=await POST(new Request('http://test/api/game',{method:'POST',body:JSON.stringify({action:'sync',...auth(host),seq:1})}));const text=await res.text();
 const g=find(state(code),guest.id),view=JSON.parse(text).room;
 assert.equal(find(view,guest.id),undefined,'the burrowed warthog is not in the host\'s view');
 assert.ok(!text.includes(guest.id)||view.roster.some(r=>r.id===guest.id),'only the roster names it');
 assert.ok(!text.includes(String(g.x))&&!text.includes(String(Math.round(g.x*100)/100)),'its coordinates appear nowhere in the response');
 assert.ok(view.roster.some(r=>r.id===guest.id&&r.name==='Guest1'),'the scoreboard still lists the player');
 // the guest sees itself, marked concealed
 const own=find((await call({action:'sync',...auth(guest),seq:1})).room,guest.id);assert.ok(own&&own.concealed);
 // nothing server-only or another animal's private plan is serialized
 for(const p of view.players){for(const k of ['token','bag','seq','lastSeen','inputAt','strikeId','strikeBorn','strikeDir'])assert.ok(!(k in p),k+' leaked');
  if(p.id!==host.id)for(const k of ['targetX','targetY','targetId','threatX','threatY','homeX','homeY','nextDrink','message','hunger','claimed','dx','dy'])assert.ok(!(k in p),k+' of '+p.id+' leaked');}
 assert.ok(!('rs' in view),'the room RNG state is not sent');
 assert.ok('hunger' in find(view,host.id)&&'claimed' in find(view,host.id),'your own animal keeps its private fields');
});

test('a quiet sync is answered without a simulation step or database write; anything new is written',async()=>{
 const host=await call({action:'create',name:'Solo'});const code=host.room.code;await call({action:'practice',...auth(host)});
 await call({action:'sync',...auth(host),seq:100,dx:1,dy:0});const w=db.writes;
 // same input a moment later: answered from the stored state
 const q=await call({action:'sync',...auth(host),seq:101,dx:1,dy:0});assert.equal(db.writes,w);assert.equal(q.room.serverTime,state(code).tick);
 // new input is never coalesced away
 await call({action:'sync',...auth(host),seq:102,dx:0,dy:1});assert.equal(db.writes,w+1);assert.equal(find(state(code),host.id).dy,1);
});

test('a lunge committed before a new life never lands after it',async()=>{
 const {host,guests:[guest],code}=await lobby(2);await call({action:'start',...auth(host)});
 const room=edit(code,room=>{const L=find(room,host.id),I=find(room,guest.id);
  Object.assign(L,{species:'lion',protectedUntil:0,deadUntil:0,heading:0,vx:0,vy:0,dx:0,dy:0,abilityUntil:0,climb:''});Object.assign(I,{species:'impala',protectedUntil:0,deadUntil:0,vx:0,vy:0,heading:0,abilityUntil:0});
  meet(room)(L,I);});
 await call({action:'sync',...auth(host),seq:1,actions:press('interact',find(room,host.id).born)});
 assert.ok(find(state(code),host.id).strikeAt,'the lunge is committed');
 await call({action:'restart',...auth(host)});
 await wait(STRIKE_WINDUP+60);await call({action:'sync',...auth(guest),seq:2});
 const after=state(code);assert.equal(find(after,guest.id).deadUntil,0,'the impala survives');assert.equal(find(after,host.id).hunts,0);
});

test('the client rebuilds exactly the server food table from the seed layout and the changes it is sent',async()=>{
 const {expandFoods}=await import('../lib/net.ts');
 const host=await call({action:'create',name:'Solo'});const code=host.room.code;await call({action:'practice',...auth(host)});
 const now=Date.now();edit(code,room=>{room.foods[3].ready=now+9000;room.foods[15].until=now+1000;room.foods.push({id:room.foods.length,x:500,y:600,kind:'carrion',ready:now+5000,until:now+90000});});
 const view=(await call({action:'sync',...auth(host),seq:1})).room,server=state(code).foods.filter(f=>!(f.until&&f.until<=view.serverTime&&f.id>=560));
 const client=expandFoods(view);const live=fs=>fs.map(f=>({...f,ready:f.ready>view.serverTime?f.ready:0}));
 assert.deepEqual(live(client),live(server));
});

test('a player\'s own reported position is taken when the animal could have run there; teleports, held animals and earlier lives are refused',async()=>{
 const {ANIMALS,UNITS_PER_METRE}=await import('../lib/game.ts');
 const host=await call({action:'create',name:'Runner'});await call({action:'practice',...auth(host)});const code=host.room.code,g=openGround();
 const me=()=>find(state(code),host.id);
 edit(code,room=>{Object.assign(find(room,host.id),{species:'lion',x:g.x,y:g.y,vx:0,vy:0,dx:0,dy:0,deadUntil:0,stunUntil:0,climb:'',perched:false,protectedUntil:Date.now()+60000});for(const p of room.players)if(p.bot&&Math.hypot(p.x-g.x,p.y-g.y)<400)p.x=(p.x+1600)%3900+50;});
 const {born}=me(),top=ANIMALS.lion.gait.sprint*UNITS_PER_METRE;let seq=100,x=g.x;
 const report=async(at,extra={})=>{await wait(110);return call({action:'sync',...auth(host),seq:++seq,dx:1,dy:0,sprint:true,x:at,y:g.y,vx:top,vy:0,born,...extra});};
 await report(x+=5);assert.equal(me().x,x,'a small step is taken as reported');assert.equal(me().fix,undefined);
 await report(x+=top*.1);assert.equal(me().x,x,'a full-speed stride between syncs is taken');
 const r=await report(x+500);assert.notEqual(me().x,x+500,'a 50 m jump is refused');assert.equal(me().fix,1);assert.equal(find(r.room,host.id).fix,1,'the owner is told to rejoin');
 x=me().x;await report(x+5,{born:born-1});assert.equal(me().fix,1,'a report from an earlier life is ignored');
 edit(code,room=>{find(room,host.id).stunUntil=Date.now()+5000;});x=me().x;await report(x+40);assert.ok(Math.abs(me().x-x)<1,'a kicked, stunned animal stays where the server holds it');assert.equal(me().fix,2);
 edit(code,room=>{find(room,host.id).stunUntil=0;});
 // running at 1.6x the species' top speed is accepted only until the jitter allowance runs out
 let refused=false,last=Date.now();x=me().x;for(let i=0;i<12&&!refused;i++){const before=me().fix;await wait(110);const t=Date.now();x+=top*1.6*(t-last)/1000;last=t;await call({action:'sync',...auth(host),seq:++seq,dx:1,dy:0,sprint:true,x,y:g.y,vx:top,vy:0,born});refused=me().fix!==before;}
 assert.ok(refused,'sustained over-speed is refused');
});

test('round length: only the host picks 5, 10 or unlimited in the lobby; guests see it; unlimited never expires until the host ends it',async()=>{
 const {host,guests:[guest],code}=await lobby(2);
 assert.equal((await call({action:'sync',...auth(guest),seq:1})).room.duration??300,300,'old and new rooms default to five minutes');
 await call({action:'configure',...auth(guest),duration:0},403);
 await call({action:'configure',...auth(host),duration:450},400);
 await call({action:'configure',...auth(host),duration:'600'},400);
 await call({action:'configure',...auth(host),duration:600});
 assert.equal((await call({action:'sync',...auth(guest),seq:2})).room.duration,600,'the guest is told the chosen length');
 let s=await call({action:'start',...auth(host)});assert.equal(s.room.ends-s.room.started,600000,'ten minutes of server time');
 await call({action:'configure',...auth(host),duration:0},409);
 await call({action:'end',...auth(guest)},403);
 await call({action:'end',...auth(host)});const ended=await call({action:'sync',...auth(guest),seq:3});assert.equal(ended.room.phase,'finished');assert.equal(ended.room.endedBy,'host');
 await call({action:'end',...auth(host)},409);
 await call({action:'configure',...auth(host),duration:0});
 s=await call({action:'start',...auth(host)});assert.equal(s.room.duration,0,'play again keeps the chosen length');assert.equal(s.room.ends,0);assert.equal(s.room.endedBy,undefined);
 // an hour later (both players still connected) the unlimited round is still running
 edit(code,room=>{const back=3600000;room.started-=back;room.tick-=back;for(const p of room.players){p.born-=back;}});
 const later=await call({action:'sync',...auth(guest),seq:4});assert.equal(later.room.phase,'playing');
 await call({action:'end',...auth(host)});assert.equal(state(code).phase,'finished');
});
test('a player disconnected mid-round is removed after 15 s and the host passes on; finished results keep everyone',async()=>{
 const {host,guests:[guest],code}=await lobby(2);await call({action:'start',...auth(host)});
 edit(code,room=>{find(room,host.id).lastSeen=Date.now()-14000;});
 let view=(await call({action:'sync',...auth(guest),seq:1})).room;assert.equal(view.roster.length,2,'inside the grace period');
 edit(code,room=>{find(room,host.id).lastSeen=Date.now()-16000;});
 view=(await call({action:'sync',...auth(guest),seq:2})).room;assert.equal(view.roster.length,1);assert.equal(view.host,guest.id);assert.equal(state(code).players.filter(p=>p.bot).length,60);
 // results: a player who drops after the round ends still shows in the results
 const g2=await lobby(2);await call({action:'start',...auth(g2.host)});await call({action:'end',...auth(g2.host)});
 edit(g2.code,room=>{find(room,g2.guests[0].id).lastSeen=Date.now()-60000;});
 view=(await call({action:'sync',...auth(g2.host),seq:3})).room;assert.equal(view.phase,'finished');assert.equal(view.roster.length,2);
});
