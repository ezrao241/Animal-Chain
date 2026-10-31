// E and Space never go quiet: a press the rules can't run says why, a quick second E waits for the re-arm, and a press
// held up behind a slow sync still counts
import test from 'node:test';import assert from 'node:assert/strict';
import {newPlayer,newRoom,interact,useAbility,tick,props,solid,solidRadius,ANIMALS} from '../lib/game.ts';
import {applyActions} from '../lib/net.ts';
const T=1800000000000;
function setup(hunter='lion',prey='impala'){const p=newPlayer('p','Hunter',T,false,hunter),q=newPlayer('q','Prey',T,false,prey);let xy;for(let x=300;x<3500&&!xy;x+=75)for(let y=300;y<2500;y+=75)if(props(417).every(o=>Math.hypot(x-o.x,y-o.y)>(solid(o)?solidRadius(o)+100:150))){xy={x,y};break;}
 Object.assign(p,xy,{heading:0,protectedUntil:0,hunger:20,lastSeen:Infinity,inputAt:Infinity});Object.assign(q,{x:p.x+400,y:p.y,heading:0,protectedUntil:0,lastSeen:Infinity,inputAt:Infinity});const r=newRoom('ABCDEF',p,T);Object.assign(r,{phase:'playing',started:T,ends:T+300000,tick:T,foods:[],players:[p,q]});return {p,q,r};}

test('Space on cooldown says when the move is ready',()=>{
 const {p,r}=setup();p.abilityReady=T+4200;useAbility(p,r,T);
 assert.equal(p.message,ANIMALS.lion.ability+' ready in 5 s');assert.equal(p.abilityUntil,0,'the move did not run');
});

test('a second E during the re-arm is held and runs as soon as the animal is ready',()=>{
 const {p,r}=setup('zebra');interact(p,r,T);const first=p.interactReady;assert.ok(first>T);
 p.message='';interact(p,r,T+200);assert.equal(p.interactQueued,T+200,'held, not dropped');
 tick(r,T+400);assert.equal(p.interactReady,first,'not before the re-arm');
 tick(r,first+50);assert.ok(p.interactReady>first,'the held press ran');assert.equal(p.interactQueued,0);assert.ok(p.message);
});

test('a held E that waited too long, or a meal that started, is let go',()=>{
 const {p,r}=setup('zebra');p.interactReady=T+5000;interact(p,r,T);assert.ok(p.interactQueued);
 tick(r,T+1500);assert.equal(p.interactQueued,0,'expired');assert.equal(p.interactReady,T+5000);
});

test('E while feeding or partway up a trunk explains itself',()=>{
 const {p,r}=setup();p.feeding={until:T+3500,duration:5000,last:T};interact(p,r,T);assert.match(p.message,/Feeding: 4 s left/);
 const l=setup('leopard');l.p.climb='trunk';interact(l.p,l.r,T);assert.match(l.p.message,/Not while climbing/);
});

test('a press that waited behind one slow sync still runs; one from a long outage does not',()=>{
 const {p,r}=setup('hyena');p.abilityReady=0;
 applyActions(p,r,[{id:1,kind:'ability',born:p.born,age:2400}],T);assert.ok(p.abilityUntil>T,'2.4 s old press ran');
 const g=setup('hyena');g.p.abilityReady=0;applyActions(g.p,g.r,[{id:1,kind:'ability',born:g.p.born,age:6000}],T);assert.equal(g.p.abilityUntil,0);assert.equal(g.p.act,1,'acknowledged');
});

