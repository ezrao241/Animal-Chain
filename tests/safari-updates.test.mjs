import test from 'node:test';import assert from 'node:assert/strict';
import {newPlayer,newRoom,start,tick,interact,resolveStrike,stepFeeding,finishRound,ANIMALS,props,solid,solidRadius,sense,move,STALK_SPEED,HUNT_REACH_MULTIPLIER,W,H} from '../lib/game.ts';
const T=1800000000000;
function setup(s='lion'){const p=newPlayer('p','Hunter',T,false,s),q=newPlayer('q','Prey',T,false,'impala');let xy;for(let x=300;x<3500&&!xy;x+=75)for(let y=300;y<2500;y+=75)if(props(417).every(o=>Math.hypot(x-o.x,y-o.y)>(solid(o)?solidRadius(o)+100:150))){xy={x,y};break;}
Object.assign(p,xy,{heading:0,protectedUntil:0,hunger:20});Object.assign(q,{x:p.x+12,y:p.y,protectedUntil:0});const r=newRoom('ABCDEF',p,T);Object.assign(r,{phase:'playing',started:T,ends:T+300000,foods:[],players:[p,q]});return {p,q,r};}
function hit(p,r,t){interact(p,r,t);resolveStrike(p,r,t+250);}
test('one landed hunt resolves once and feeding remains proportional',()=>{for(const [s,sec] of [['lion',5],['leopard',7],['hyena',6]]){const {p,q,r}=setup(s);hit(p,r,T);assert.ok(q.deadUntil);resolveStrike(p,r,T+300);assert.ok(q.deadUntil);assert.equal(p.hunts,1);assert.equal(p.feeding.duration,sec*1000);assert.equal(p.hunger,20);const f={...p.feeding};stepFeeding(p,f.last+f.duration/2);assert.equal(p.hunger,42.5);p.dx=1;stepFeeding(p,f.until);assert.equal(p.feeding,undefined);assert.equal(p.hunger,42.5);assert.equal(p.hunts,1);}});
test('range boundary is 44% wider after the second increase with no change to food range',()=>{for(const delta of [-.01,.01]){const{p,q,r}=setup();q.x=p.x+ANIMALS.lion.catchRange*HUNT_REACH_MULTIPLIER+delta;interact(p,r,T);assert.equal(Boolean(p.strikeId),delta<0);}});
test('five, ten and unlimited use authoritative expiry; unlimited ends explicitly',()=>{for(const duration of [300,600,0]){const p=newPlayer('p','P',T),r=newRoom('ABCDEF',p,T);r.duration=duration;start(r,T);assert.equal(r.ends,duration?T+duration*1000:0);r.players=[];tick(r,T+300000);assert.equal(r.phase,duration===300?'finished':'playing');tick(r,T+600001);assert.equal(r.phase,duration===0?'playing':'finished');if(!duration){finishRound(r,T+700000);assert.equal(r.phase,'finished');}}});
test('one landed hit catches healthy prey in every allowed species matchup',()=>{
 for(const attacker of ['lion','leopard','hyena'])for(const defender of ANIMALS[attacker].prey){
  const {p,q,r}=setup(attacker);q.species=defender;q.heading=0;
  if(attacker==='hyena'&&defender==='zebra')for(let i=0;i<2;i++){const ally=newPlayer('ally'+i,'Clan',T,true,'hyena');Object.assign(ally,{x:p.x-10,y:p.y+10+i*10,protectedUntil:0});r.players.push(ally);}
  hit(p,r,T);assert.ok(q.deadUntil,`${attacker} -> ${defender}`);assert.equal(p.hunts,1);
 }
});

test('stalking leopard cannot be sensed by any species and moves faster',()=>{
 const {p,q,r}=setup('leopard');Object.assign(p,{abilityUntil:T+4000,dx:1,dy:0,vx:0,vy:0});
 for(const species of Object.keys(ANIMALS)){q.species=species;assert.equal(sense(q,p,r,T+1),null,species);}
 for(let i=0;i<20;i++)move(p,.05,[],T+i*50);assert.ok(Math.abs(p.vx/10-STALK_SPEED)<.1);
 p.dx=0;move(p,.05,[],T+1000);assert.ok(p.vx>0&&p.vx<STALK_SPEED*10);for(let i=0;i<20;i++)move(p,.05,[],T+1050+i*50);assert.equal(p.vx,0);assert.equal(p.vy,0);
});
test('hunt accepts a target 75 degrees to the side but rejects one behind',()=>{for(const degrees of [75,100]){const{p,q,r}=setup();q.x=p.x+20*Math.cos(degrees*Math.PI/180);q.y=p.y+20*Math.sin(degrees*Math.PI/180);hit(p,r,T);assert.equal(Boolean(q.deadUntil),degrees===75);}});