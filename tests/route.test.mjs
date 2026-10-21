// The authoritative multiplayer handler (app/api/game/route.ts) with an in-memory database: simultaneous requests,
// late or repeated input, a predator and prey player meeting, respawns, and no token leaks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./route-loader.mjs',import.meta.url);
const {POST}=await import('../app/api/game/route.ts');
const {db}=await import('./fake-workers.mjs');
const call=async(body,expected=200)=>{const res=await POST(new Request('http://test/api/game',{method:'POST',body:JSON.stringify(body)}));const data=await res.json();assert.equal(res.status,expected,body.action+': '+(data.error||''));return data;};
const auth=d=>({code:d.room.code,id:d.id,token:d.token});
const state=code=>JSON.parse(db.rows.get(code).state);
const save=(code,room)=>{const row=db.rows.get(code);db.rows.set(code,{...row,state:JSON.stringify(room),version:row.version+1});};
test('two players: start, simultaneous syncs, stale input, an encounter and a respawn stay consistent',async()=>{
 const host=await call({action:'create',name:'Host'}),guest=await call({action:'join',name:'Guest',code:host.room.code});const code=host.room.code;
 await call({action:'start',...auth(guest)},403);
 const started=await call({action:'start',...auth(host)});assert.equal(started.room.players.length,62);assert.ok(started.room.players.every(p=>!('token' in p)));
 // 20 rounds of both players syncing at the same moment: every write lands (retries absorb version conflicts)
 let seq=1000;for(let i=0;i<20;i++)await Promise.all([call({action:'sync',...auth(host),seq:++seq,dx:1,dy:0}),call({action:'sync',...auth(guest),seq:++seq,dx:0,dy:1})]);
 assert.ok(db.conflicts>0,'the test really interleaved writes');
 const r=state(code);assert.equal(r.players.filter(p=>!p.bot).length,2);
 // a late packet (older seq) and a repeated packet must not override newer input
 await call({action:'sync',...auth(host),seq:5000,dx:-1,dy:0});await call({action:'sync',...auth(host),seq:4000,dx:1,dy:0});await call({action:'sync',...auth(host),seq:5000,dx:0,dy:1,interact:true});
 const h=state(code).players.find(p=>p.id===host.id);assert.equal(h.dx,-1);assert.equal(h.seq,5000);
 // predator meets prey: make the host a lion and the guest an impala right beside it, both unprotected
 const room=state(code);const L=room.players.find(p=>p.id===host.id),I=room.players.find(p=>p.id===guest.id);
 Object.assign(L,{species:'lion',protectedUntil:0,deadUntil:0});Object.assign(I,{species:'impala',protectedUntil:0,deadUntil:0,x:L.x+12,y:L.y,abilityUntil:0});for(const p of room.players)if(p.bot&&Math.hypot(p.x-L.x,p.y-L.y)<200)p.x=(p.x+1500)%3900+50;save(code,room);
 const [a,b]=await Promise.all([call({action:'sync',...auth(host),seq:6000,dx:0,dy:0,interact:true}),call({action:'sync',...auth(guest),seq:6001,dx:0,dy:0})]);
 for(const view of [a.room,b.room]){const lion=view.players.find(p=>p.id===host.id),imp=view.players.find(p=>p.id===guest.id);if(lion.hunts){assert.ok(imp.deadUntil,'both views agree the impala was caught');}}
 const after=state(code);assert.equal(after.players.find(p=>p.id===host.id).hunts,1);const dead=after.players.find(p=>p.id===guest.id);assert.ok(dead.deadUntil);assert.ok(after.foods.some(f=>f.kind==='carrion'&&f.until),'a carcass was left');
 // input from the dead player is harmless, and after the timer it respawns as a different animal with points kept
 const deadUntil=dead.deadUntil;dead.deadUntil=Date.now()-1;const room2=after;save(code,room2);
 const back=await call({action:'sync',...auth(guest),seq:7000,dx:1,dy:0});const g=back.room.players.find(p=>p.id===guest.id);assert.equal(g.deadUntil,0);assert.notEqual(g.species,'impala');assert.ok(deadUntil>0);
 // restart (new life) and leaving hand the room to the guest
 const restarted=await call({action:'restart',...auth(host)});assert.ok(restarted.room.players.find(p=>p.id===host.id).deadUntil);
 const left=await call({action:'leave',...auth(host)});assert.equal(left.room.host,guest.id);
 await call({action:'sync',...auth(host),seq:9000},401);
 await call({action:'sync',code,id:'wild-1',token:'x',seq:1},401);
});
test('solo practice room: one player and the full wildlife',async()=>{
 const host=await call({action:'create',name:'Solo'});const solo=await call({action:'practice',...auth(host)});assert.equal(solo.room.practice,true);assert.equal(solo.room.players.length,61);
});
