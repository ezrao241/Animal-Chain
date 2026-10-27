import test from 'node:test';import assert from 'node:assert/strict';
import {newPlayer,newRoom,start,tick,interact,resolveStrike,stepFeeding,finishRound,ANIMALS,props,solid,solidRadius,driveEscape,stepPoachers} from '../lib/game.ts';
const T=1800000000000;
function setup(s='lion'){const p=newPlayer('p','Hunter',T,false,s),q=newPlayer('q','Prey',T,false,'impala');let xy;for(let x=300;x<3500&&!xy;x+=75)for(let y=300;y<2500;y+=75)if(props(417).every(o=>Math.hypot(x-o.x,y-o.y)>(solid(o)?solidRadius(o)+100:150))){xy={x,y};break;}
Object.assign(p,xy,{heading:0,protectedUntil:0,hunger:20});Object.assign(q,{x:p.x+12,y:p.y,protectedUntil:0});const r=newRoom('ABCDEF',p,T);Object.assign(r,{phase:'playing',started:T,ends:T+300000,foods:[],players:[p,q]});return {p,q,r};}
function hit(p,r,t){interact(p,r,t);resolveStrike(p,r,t+250);}
test('healthy prey survives first strike; distinct presses finish once, feeding is proportional',()=>{for(const [s,sec] of [['lion',5],['leopard',7],['hyena',6]]){const {p,q,r}=setup(s);hit(p,r,T);assert.equal(q.deadUntil,0);assert.ok(q.health>0&&q.health<100);const hp=q.health;resolveStrike(p,r,T+300);assert.equal(q.health,hp);for(let i=1;i<6&&!q.deadUntil;i++)hit(p,r,T+i*1200);assert.ok(q.deadUntil);assert.equal(p.hunts,1);assert.equal(p.feeding.duration,sec*1000);assert.equal(p.hunger,20);const f={...p.feeding};stepFeeding(p,f.last+f.duration/2);assert.equal(p.hunger,42.5);p.dx=1;stepFeeding(p,f.until);assert.equal(p.feeding,undefined);assert.equal(p.hunger,42.5);assert.equal(p.hunts,1);}});
test('range boundary is exactly 20% wider with no change to food range',()=>{for(const delta of [-.01,.01]){const{p,q,r}=setup();q.x=p.x+ANIMALS.lion.catchRange*1.2+delta;interact(p,r,T);assert.equal(Boolean(p.strikeId),delta<0);}});
test('five, ten and unlimited use authoritative expiry; unlimited ends explicitly',()=>{for(const duration of [300,600,0]){const p=newPlayer('p','P',T),r=newRoom('ABCDEF',p,T);r.duration=duration;start(r,T);assert.equal(r.ends,duration?T+duration*1000:0);r.players=[];r.poachers=[];tick(r,T+300000);assert.equal(r.phase,duration===300?'finished':'playing');tick(r,T+600001);assert.equal(r.phase,duration===0?'playing':'finished');if(!duration){finishRound(r,T+700000);assert.equal(r.phase,'finished');}}});
test('poachers never target prey and a shot cannot defeat a healthy predator',()=>{const{p,q,r}=setup();r.poachers=[{x:p.x-60,y:p.y,jeepX:p.x-100,jeepY:p.y,exitX:0,exitY:p.y,state:'defending',target:p.id,health:60,since:T,shotAt:0,nextShot:0,heading:0}];p.lastSeen=T+1500;r.tick=T+1000;tick(r,T+1200);assert.equal(p.health,75);assert.equal(p.deadUntil,0);r.poachers[0].target=q.id;r.poachers[0].state='defending';r.poachers[0].since=T;tick(r,T+1400);assert.equal(q.health,100);assert.equal(r.poachers[0].state,'retreating');});

test('jeep steers around a stationary animal and reaches the exit without overlap',()=>{
 const {p,r}=setup();r.players=[p];const n={x:p.x+90,y:p.y,jeepX:p.x+90,jeepY:p.y,exitX:p.x-80,exitY:p.y,state:'escaping',heading:Math.PI};
 for(let i=0;i<500&&n.state!=='gone';i++){driveEscape(n,r,.05);assert.ok(Math.hypot(n.jeepX-p.x,n.jeepY-p.y)>=38);}
 assert.equal(n.state,'gone');
});
test('retreat reaches door, enters and escapes, repeated attacks do not restart warning clock',()=>{
 const {p,r}=setup();const n={x:p.x+12,y:p.y,jeepX:p.x-25,jeepY:p.y,exitX:p.x-150,exitY:p.y,state:'guarding',target:'',health:100,since:0,shotAt:0,nextShot:0,heading:0};r.poachers=[n];
 interact(p,r,T);assert.equal(n.state,'defending');const since=n.since;interact(p,r,T+700);assert.equal(n.since,since);
 n.state='retreating';r.players=[];for(let i=0;i<300&&n.state!=='gone';i++)stepPoachers(r,T+3000+i*50,.05);assert.equal(n.state,'gone');
});

test('healthy prey takes two or three landed hits in every allowed species matchup',()=>{
 for(const attacker of ['lion','leopard','hyena'])for(const defender of ANIMALS[attacker].prey){
  const {p,q,r}=setup(attacker);q.species=defender;q.heading=0;
  if(attacker==='hyena'&&defender==='zebra')for(let i=0;i<2;i++){const ally=newPlayer('ally'+i,'Clan',T,true,'hyena');Object.assign(ally,{x:p.x-10,y:p.y+10+i*10,protectedUntil:0});r.players.push(ally);}
  let strikes=0;while(!q.deadUntil&&strikes<4){hit(p,r,T+strikes*1500);strikes++;if(strikes===1)assert.equal(q.deadUntil,0);}
  assert.ok(q.deadUntil,`${attacker} -> ${defender} must finish`);assert.ok(strikes===2||strikes===3,`${attacker} -> ${defender}: ${strikes}`);
 }
});
