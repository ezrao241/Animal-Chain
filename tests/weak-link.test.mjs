// Weak connections: the device's link estimate (lib/link.ts), the server accepting positions after a long gap between
// syncs, and the lighter view a weak link asks for (lib/net.ts viewFor lite).
import test from 'node:test';import assert from 'node:assert/strict';
import {LinkMonitor,LINK} from '../lib/link.ts';
import {claim,viewFor,expandView,encode,CLAIM_GAP_MS,LITE_VIEW,roomRequest} from '../lib/net.ts';
import {newPlayer,newRoom,start,tick,ANIMALS,UNITS_PER_METRE,dist} from '../lib/game.ts';
const T=1800000000000;

test('the link estimate: good, fair and poor from round trips and losses, slow to recover',()=>{
 const l=new LinkMonitor();for(let i=0;i<20;i++)l.sample(80,T+i*140);
 assert.equal(l.quality,'good');assert.equal(l.pollMs(),LINK.pollMs.good);assert.equal(l.lite,false);
 assert.equal(l.timeoutMs(),LINK.minTimeoutMs,'a fast link still waits the minimum before resending');
 for(let i=0;i<40;i++)l.sample(900,T+3000+i*300);
 assert.equal(l.quality,'poor');assert.ok(l.lite);assert.equal(l.pollMs(),LINK.pollMs.poor);
 assert.ok(l.timeoutMs()<=LINK.maxTimeoutMs&&l.timeoutMs()>=900,'timeout follows the round trip');
 // back to a fast link: stays poor until it has held up for recoverMs
 let t=T+20000;l.sample(80,t);for(let i=0;i<30;i++)l.sample(80,t+=100);
 assert.notEqual(l.quality,'good','recovered within '+(t-T-20000)+' ms');
 for(let i=0;i<80;i++)l.sample(80,t+=100);
 assert.equal(l.quality,'good','never recovered');
 // two lost requests in the window make it poor at once; they age out
 l.lost(t);assert.equal(l.quality,'fair');l.lost(t+500);assert.equal(l.quality,'poor');
 for(let i=0;i<100;i++)l.sample(80,t+=200);assert.equal(l.quality,'good','losses never aged out');
});

test('a reported position after a 3 s gap between syncs is accepted, not snapped back',()=>{
 const p=newPlayer('h','H',T,false,'impala');Object.assign(p,{x:300,y:1400,protectedUntil:0});
 const top=ANIMALS.impala.gait.sprint*UNITS_PER_METRE,report=(x,now)=>claim(p,{x,y:p.y,vx:top,vy:0,born:p.born},now);
 const x0=p.x;report(x0,T);
 // 3 s at 90% of top speed: the old 1.5 s cap refused this
 const gap=3000,x1=x0+top*.9*gap/1000;report(x1,T+gap);
 assert.equal(p.fix??0,0,'refused');assert.ok(Math.abs(p.x-x1)<1);
 // still no teleporting: twice top speed is cut short where top speed (with the jitter allowance) would have got it,
 // so the device is pulled back by the excess only
 const from=p.x;report(from+top*2*gap/1000,T+2*gap);assert.equal(p.fix,1);
 assert.ok(p.x>from+top*gap/1000&&p.x<from+top*1.1*gap/1000+100,'cut short at '+Math.round(p.x-from));
 assert.ok(CLAIM_GAP_MS>=3000);
});

function party(){const host=newPlayer('host','Host',T);host.token='t';const room=newRoom('ABCDEF',host,T);const guest=newPlayer('guest','Guest',T);guest.token='g';room.players.push(guest);start(room,T);for(let t=T+200;t<=T+20000;t+=200){for(const p of room.players)if(!p.bot){p.lastSeen=t;p.inputAt=t;}tick(room,t);}return room;}

test('the lite view is much smaller, keeps every animal and leaves players untouched',()=>{
 const room=party(),now=room.tick,full=viewFor(room,'host',now),lite=viewFor(room,'host',now,true);
 const a=encode(full).length,b=encode(lite).length;
 assert.ok(b<a*.75,`lite ${b} B vs full ${a} B`);
 assert.deepEqual(lite.players.map(p=>p.id),full.players.map(p=>p.id),'an animal went missing');
 for(const id of ['host','guest'])assert.deepEqual(lite.players.find(p=>p.id===id),full.players.find(p=>p.id===id),id+' changed');
 const me=room.players.find(p=>p.id==='host');
 for(const p of lite.players.filter(p=>p.bot)){
  for(const k of ['id','species','x','y','vx','vy','heading','born'])assert.ok(k in p,k+' missing from '+p.id);
  const real=room.players.find(q=>q.id===p.id);assert.ok(Math.hypot(p.x-real.x,p.y-real.y)<1,'position off');
  for(const k of ['deadUntil','abilityUntil','stunUntil','perched'])assert.equal(!!p[k]&&(typeof p[k]!=='number'||p[k]>now-3000),!!real[k]&&(typeof real[k]!=='number'||real[k]>now-3000),k);
  if(dist(me,real)<LITE_VIEW)assert.equal(p.mood,real.mood,'near animal lost its mood');
 }
 assert.equal(expandView(lite).foods.length,expandView(full).foods.length);
});

test('a sync asking for lite gets the lite view',()=>{
 const room=party(),before=room.tick;const body={action:'sync',id:'host',token:'t',seq:99,dx:1,dy:0};
 const full=roomRequest(room,{...body},'sync',before+150,()=>'x'),lite=roomRequest(room,{...body,seq:100,lite:true},'sync',before+300,()=>'x');
 assert.ok(encode(lite.body).length<encode(full.body).length*.75);
});
