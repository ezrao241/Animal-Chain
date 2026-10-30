import test from 'node:test';import assert from 'node:assert/strict';
import {newPlayer,newRoom,start,tick,interact,resolveStrike,stepFeeding,finishRound,ANIMALS,props,solid,solidRadius,sense,move,creptBehind,FORWARD_ARC,STALK_SPEED,HUNT_REACH_MULTIPLIER,W,H} from '../lib/game.ts';
const T=1800000000000;
function setup(s='lion'){const p=newPlayer('p','Hunter',T,false,s),q=newPlayer('q','Prey',T,false,'impala');let xy;for(let x=300;x<3500&&!xy;x+=75)for(let y=300;y<2500;y+=75)if(props(417).every(o=>Math.hypot(x-o.x,y-o.y)>(solid(o)?solidRadius(o)+100:150))){xy={x,y};break;}
Object.assign(p,xy,{heading:0,protectedUntil:0,hunger:20});Object.assign(q,{x:p.x+12,y:p.y,protectedUntil:0});const r=newRoom('ABCDEF',p,T);Object.assign(r,{phase:'playing',started:T,ends:T+300000,foods:[],players:[p,q]});return {p,q,r};}
function hit(p,r,t){interact(p,r,t);resolveStrike(p,r,t+250);}
test('one landed hunt resolves once and feeding remains proportional',()=>{for(const [s,sec] of [['lion',5],['leopard',7],['hyena',6]]){const {p,q,r}=setup(s);hit(p,r,T);assert.ok(q.deadUntil);resolveStrike(p,r,T+300);assert.ok(q.deadUntil);assert.equal(p.hunts,1);assert.equal(p.feeding.duration,sec*1000);assert.equal(p.hunger,20);const f={...p.feeding};stepFeeding(p,f.last+f.duration/2);assert.equal(p.hunger,42.5);p.dx=1;stepFeeding(p,f.until);assert.equal(p.feeding,undefined);assert.equal(p.hunger,42.5);assert.equal(p.hunts,1);}});
test('catch range boundary sits at catchRange x 1.44 x 1.18 (about 70% wider) with no change to food range',()=>{for(const delta of [-.01,.01]){const{p,q,r}=setup();q.x=p.x+ANIMALS.lion.catchRange*HUNT_REACH_MULTIPLIER+delta;interact(p,r,T);assert.equal(Boolean(p.strikeId),delta<0);}});
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
test('a quiet player predator behind wild prey (outside its 220 degree forward arc) sets off no close or scent alert; in front or sprinting it does',()=>{
 const {p,q,r}=setup('lion');q.bot=true;q.heading=0;q.mood='graze';
 for(const [deg,sprint,expected] of [[180,false,true],[120,false,true],[100,false,false],[0,false,false],[180,true,false]]){
  const a=deg*Math.PI/180;Object.assign(p,{x:q.x+30*Math.cos(a),y:q.y+30*Math.sin(a),vx:0,vy:0,sprint});
  if(sprint)Object.assign(p,{vx:200*Math.cos(a+Math.PI),vy:200*Math.sin(a+Math.PI)});
  assert.equal(creptBehind(q,p,r,T),expected,deg+' deg sprint '+sprint);
  const cue=sense(q,p,r,T);if(expected)assert.ok(!cue||cue.how==='sight'||cue.how==='sound',deg+' only sight or sound may notice it');else if(!sprint)assert.ok(cue,deg+' noticed up close');
 }
 // not a valid matchup (a leopard can't take a zebra): no special rule
 q.species='zebra';p.species='leopard';Object.assign(p,{x:q.x-30,y:q.y,sprint:false,vx:0,vy:0});assert.equal(creptBehind(q,p,r,T),false);
 assert.equal(FORWARD_ARC,220);
});

test('player posture: crouching caps speed at a walk and hides better; lying down stops, hides more and recovers faster',async()=>{
 const {conspicuity,POSTURE_SIGHT}=await import('../lib/game.ts');const {roomRequest}=await import('../lib/net.ts');
 const run=posture=>{const {p,r}=setup('lion');Object.assign(p,{posture,dx:1,dy:0,sprint:false,vx:0,vy:0,stamina:50});for(let i=0;i<40;i++)move(p,.05,props(417),T+i*50);return p;};
 const free=run(undefined),low=run('crouch'),flat=run('lie');
 assert.ok(Math.hypot(free.vx,free.vy)/10>ANIMALS.lion.gait.walk+1,'standing it runs');
 assert.ok(Math.hypot(low.vx,low.vy)/10<=ANIMALS.lion.gait.walk+1e-6,'crouched: no faster than a walk');
 assert.equal(Math.hypot(flat.vx,flat.vy),0,'lying down: still');
 const {p}=setup('lion'),ps=props(417);p.vx=p.vy=0;const c0=conspicuity(p,ps,T);
 p.posture='crouch';assert.ok(Math.abs(conspicuity(p,ps,T)-c0*POSTURE_SIGHT.crouch)<1e-9);
 p.posture='lie';assert.ok(Math.abs(conspicuity(p,ps,T)-c0*POSTURE_SIGHT.lie)<1e-9);
 // the server takes the posture with each sync and ignores anything else
 const {r}=setup('lion'),me=r.players[0];Object.assign(me,{token:'t',seq:0});
 roomRequest(r,{id:me.id,token:'t',seq:1,dx:0,dy:0,posture:'lie'},'sync',T+10,()=>'x');assert.equal(me.posture,'lie');
 roomRequest(r,{id:me.id,token:'t',seq:2,dx:0,dy:0,posture:'fly'},'sync',T+20,()=>'x');assert.equal(me.posture,undefined);
});
