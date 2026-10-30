import test from 'node:test';import assert from 'node:assert/strict';
import {newPlayer,newRoom,start,tick,interact,worldEvent,fireArrival,fireEdge,burnAt,fireEscape,sense,EVENT_AT,EVENT_CHANCE,FIRE_SHARE,FIRE,FIRE_BURN,FIRE_HEAT,FIRE_HEAT_RATE,FIRE_HEAL,SMOKE_MS,SMOKE_RATE,MIGRANTS,TREK_POINTS,DAY_MS,W,H,makeFoods,props,nearWater,deathLesson} from '../lib/game.ts';
const T=1800000000000;
// a started room with only the given players (no wildlife), and the round number that gives each event kind
function room(kind,players=[]){for(let round=1;round<400;round++){const host=newPlayer('h','Host',T),r=newRoom('ABCDEF',host,T);r.round=round-1;start(r,T);if(worldEvent(r,T)?.kind===kind){r.players=players;return r;}}throw new Error('no round with '+kind);}

test('events come on some days only, fire the rarer, the same on every device and different from game to game',()=>{
 const r=room('fire'),a=worldEvent(r,T),b=worldEvent({...r},T+EVENT_AT+1000);
 assert.deepEqual(a,b);assert.equal(a.at,T+EVENT_AT);assert.equal(a.until,a.at+FIRE.run);
 assert.equal(worldEvent({started:0,seed:417,round:1},T),null);
 // many games, each a new room's first round started at a different moment
 const n=2000,kinds={fire:0,migration:0,none:0};for(let i=0;i<n;i++){const s=T+i*7919123;kinds[worldEvent({started:s,seed:417,round:1},s)?.kind??'none']++;}
 assert.ok(Math.abs(kinds.none/n-(1-EVENT_CHANCE))<.05,'most games are quiet');assert.ok(kinds.fire<kinds.migration,'fire is the rarer');
 assert.ok(Math.abs(kinds.fire/n-EVENT_CHANCE*FIRE_SHARE)<.04);
 // later days of a long round draw again
 const days=new Set();for(let d=0;d<12;d++)days.add(worldEvent(r,T+d*DAY_MS+1)?.kind??'none');assert.ok(days.size>1);
});

test('the fire edge grows as a downwind ellipse: head, flank and back reach at their real rates',()=>{
 const ev=worldEvent(room('fire'),T),s=30,e=fireEdge(ev,s);
 for(const [along,side,rate] of [[1,0,FIRE.head],[-1,0,FIRE.back],[0,1,null]]){
  const d=along>0?e.a+(e.cx-ev.x)*ev.ux+(e.cy-ev.y)*ev.uy:along<0?e.a-((e.cx-ev.x)*ev.ux+(e.cy-ev.y)*ev.uy):0;
  if(rate===null)continue;
  const x=ev.x+ev.ux*along*d,y=ev.y+ev.uy*along*d;
  if(nearWater(props(417),x,y))continue;
  assert.ok(Math.abs(d-rate*10*s)<1e-6,'distance travelled matches the rate');
  assert.ok(Math.abs(fireArrival(ev,x,y)-(ev.at+s*1000))<1,'front arrives on time');
 }
 assert.equal(fireArrival(ev,ev.x+ev.ux*FIRE.head*10*(FIRE.run/1000+5),ev.y+ev.uy*FIRE.head*10*(FIRE.run/1000+5)),Infinity,'past where the fire died down');
});

test('ground passes from flames to burnt to green flush; water never burns',()=>{
 const r=room('fire'),ev=worldEvent(r,T);let q;for(let d=200;d<900&&!q;d+=20){const x=ev.x+ev.ux*d,y=ev.y+ev.uy*d;if(!nearWater(props(417),x,y))q={x,y};}
 const t=fireArrival(ev,q.x,q.y);
 assert.equal(burnAt(r,q.x,q.y,t-100),'');assert.equal(burnAt(r,q.x,q.y,t+100),'flames');assert.equal(burnAt(r,q.x,q.y,t+FIRE.flame+100),'burnt');assert.equal(burnAt(r,q.x,q.y,t+FIRE.flush+100),'flush');
 const w=props(417).find(p=>p.kind==='water');assert.equal(burnAt(r,w.x,w.y,ev.until-1),'');
});

test('burns build like storm damage: a dash through hurts, lingering kills, the heat ahead burns slowly, smoke keeps hurting, then burns ease off; a burrowed warthog is safe',()=>{
 const p=newPlayer('p','P',T,false,'impala'),r=room('fire',[p]),ev=worldEvent(r,T);let q;for(let d=300;d<900&&!q;d+=20){const x=ev.x+ev.ux*d,y=ev.y+ev.uy*d;if(!nearWater(props(417),x,y))q={x,y};}
 const t=fireArrival(ev,q.x,q.y),keep=at=>{p.lastSeen=p.inputAt=at;},run=(a,b)=>{for(let s=a+500;s<=b;s+=500)tick(r,s);};
 Object.assign(p,{x:q.x,y:q.y,protectedUntil:0,hunger:100});keep(t+1e6);
 // the heat just ahead of the front burns at a fraction of the flames' rate
 r.tick=t-FIRE_HEAT+100;tick(r,t-100);assert.ok(p.scorch>0&&p.scorch<(FIRE_HEAT-200)/1000*FIRE_HEAT_RATE+.05,'heat ahead burns slowly');
 r.tick=t;p.scorch=0;run(t,t+2000);assert.equal(p.deadUntil,0,'two seconds in the flames hurts but is survivable');assert.ok(Math.abs(p.scorch-2)<.05);
 // stepping clear lets the burns ease off
 const out={x:p.x,y:p.y};Object.assign(p,{x:ev.x-ev.ux*2000,y:ev.y-ev.uy*2000});if(burnAt(r,p.x,p.y,t+10000)===''){run(t+2000,t+2000+SMOKE_MS);assert.ok(Math.abs(p.scorch-(2+SMOKE_MS/1000*SMOKE_RATE))<.05,'smoke in the lungs keeps hurting after leaving');run(t+2000+SMOKE_MS,t+6000+SMOKE_MS);assert.ok(Math.abs(p.scorch-(2+SMOKE_MS/1000*(SMOKE_RATE-FIRE_HEAL)))<.05,'then burns ease off');}
 Object.assign(p,out);p.scorch=2;p.smokeUntil=0;r.tick=t+500;run(t+500,t+3000);assert.ok(p.deadUntil,'lingering in the flames kills');assert.match(p.lives.at(-1).cause,/grass fire/);assert.match(deathLesson(p.lives.at(-1).cause,'impala'),/crosswind/);assert.equal(p.scorch,0);
 const hog=newPlayer('w','W',T,false,'warthog'),r2=room('fire',[hog]);Object.assign(hog,{x:q.x,y:q.y,protectedUntil:0,abilityUntil:t+10000,lastSeen:t+60000,inputAt:t+60000,hunger:100});r2.tick=t;for(let s=t+500;s<=t+5000;s+=500)tick(r2,s);assert.equal(hog.deadUntil,0);assert.ok(!hog.scorch);
});

test('burnt ground: no grass to eat until the flush, which pays more; no cover to hide in',()=>{
 const z=newPlayer('z','Z',T,false,'zebra'),r=room('fire',[z]),ev=worldEvent(r,T),foods=makeFoods(417);
 const f=foods.find(f=>f.kind==='grass'&&fireArrival(ev,f.x,f.y)<ev.until-20000);assert.ok(f,'some grass burns');r.foods=[{...f}];
 const t=fireArrival(ev,f.x,f.y);Object.assign(z,{x:f.x,y:f.y,hunger:50,interactReady:0,protectedUntil:0});
 interact(z,r,t+FIRE.flame+500);assert.equal(z.food,0,'burnt grass is gone');
 z.interactReady=0;const before=z.score;interact(z,r,t+FIRE.flush+500);assert.equal(z.food,1);assert.equal(z.score-before,6,'green shoots +3 on top of food');
 // a lion standing still at a thicket on the black is no longer hidden from prey
 const lion=newPlayer('l','L',T,false,'lion'),imp=newPlayer('i','I',T,false,'impala'),bush=props(417).find(b=>b.kind==='bush'&&fireArrival(ev,b.x,b.y)<ev.until-10000);
 if(bush){const r2=room('fire',[lion,imp]);Object.assign(lion,{x:bush.x+5,y:bush.y,dx:0,dy:0,vx:0,vy:0});Object.assign(imp,{x:bush.x+5,y:bush.y+40,heading:-Math.PI/2});
  const tb=fireArrival(ev,bush.x,bush.y);assert.equal(sense(imp,lion,r2,tb-60000),null,'hidden in the thicket before the fire');assert.ok(sense(imp,lion,r2,tb+FIRE.flame+1000),'seen on the black');}
});

test('wild animals run crosswind from the head and stop once on the black',()=>{
 const p=newPlayer('wild-1','Impala',T,true,'impala'),r=room('fire',[p]),ev=worldEvent(r,T);let q;for(let d=400;d<900&&!q;d+=20){const x=ev.x+ev.ux*d,y=ev.y+ev.uy*d;if(!nearWater(props(417),x,y))q={x,y};}
 const t=fireArrival(ev,q.x,q.y);Object.assign(p,{x:q.x,y:q.y});
 const g=fireEscape(r,p,t-5000);assert.ok(g);const gx=g.x-p.x,gy=g.y-p.y;assert.ok(Math.abs(gx*ev.ux+gy*ev.uy)/Math.hypot(gx,gy)<.2,'mostly crosswind');
 assert.equal(fireEscape(r,p,t+FIRE.flame+500),null);assert.equal(fireEscape(r,p,t-30000),null);
});

test('the migration: a zebra column files in from the south, walks north, leaves; a zebra player running with it is paid once',()=>{
 const z=newPlayer('z','Z',T,false,'zebra'),r=room('migration',[z]),ev=worldEvent(r,T);
 Object.assign(z,{x:ev.x0,y:H-300,protectedUntil:0,hunger:100,lastSeen:T+1e6,inputAt:T+1e6,dx:0,dy:0});
 for(let t=T+1000;t<=ev.at-1000;t+=1000)tick(r,t);assert.equal(r.players.length,1,'nothing before 16:00');
 const counts=[];let score0=z.score;
 for(let t=ev.at;t<=ev.until+100000;t+=500){z.lastSeen=z.inputAt=t;if(t<ev.at+40000){const lead=r.players.filter(p=>p.lane).sort((a,b)=>a.y-b.y).at(-1);if(lead){z.x=lead.x+40;z.y=lead.y;}}tick(r,t);counts.push(r.players.filter(p=>p.lane).length);}
 assert.equal(Math.max(...counts),MIGRANTS);assert.equal(counts.at(-1),0,'all walked off the north edge');
 assert.equal(z.score-score0>=TREK_POINTS,true);assert.ok(z.done.includes('trek:0'));
});
