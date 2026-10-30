import test from 'node:test';import assert from 'node:assert/strict';
import {newPlayer,newRoom,interact,resolveStrike,useAbility,props,solid,solidRadius,SPAWN_PROTECT_MS,WILD_PROTECT_MS} from '../lib/game.ts';
const T=1800000000000;
function setup(hunter='lion',prey='impala'){const p=newPlayer('p','Hunter',T,false,hunter),q=newPlayer('q','Prey',T,false,prey);let xy;for(let x=300;x<3500&&!xy;x+=75)for(let y=300;y<2500;y+=75)if(props(417).every(o=>Math.hypot(x-o.x,y-o.y)>(solid(o)?solidRadius(o)+100:150))){xy={x,y};break;}
Object.assign(p,xy,{heading:0,protectedUntil:0,hunger:20});Object.assign(q,{x:p.x+12,y:p.y,heading:0,protectedUntil:0});const r=newRoom('ABCDEF',p,T);Object.assign(r,{phase:'playing',started:T,ends:T+300000,foods:[],players:[p,q]});return {p,q,r};}
const hit=(p,r,t)=>{interact(p,r,t);resolveStrike(p,r,t+250);};

test('spawn protection is 5-8 s for players and shorter for wildlife',()=>{
 assert.ok(SPAWN_PROTECT_MS>=5000&&SPAWN_PROTECT_MS<=8000);
 assert.equal(newPlayer('h','H',T).protectedUntil,T+SPAWN_PROTECT_MS);
 assert.equal(newPlayer('wild-1','Lion',T,true,'lion').protectedUntil,T+WILD_PROTECT_MS);
});

test('a freshly spawned player cannot be caught until the shield runs out',()=>{
 const {p,q,r}=setup();q.protectedUntil=T+SPAWN_PROTECT_MS;
 hit(p,r,T+1000);assert.equal(q.deadUntil,0,'caught during the shield');
 const after=T+SPAWN_PROTECT_MS+10;p.interactReady=0;hit(p,r,after);assert.ok(q.deadUntil>0,'not caught after the shield');
});

test('lunging ends the hunter\'s own shield; eating does not',()=>{
 const {p,q,r}=setup();p.protectedUntil=T+SPAWN_PROTECT_MS;
 interact(p,r,T+500);assert.ok(p.strikeId,'the lunge started');assert.ok(p.protectedUntil<T+500,'shield still up after lunging');
 // a hunter that only eats or drinks keeps its shield
 const g=setup('zebra','lion');g.p.protectedUntil=T+SPAWN_PROTECT_MS;interact(g.p,g.r,T+500);assert.equal(g.p.protectedUntil,T+SPAWN_PROTECT_MS);
});

test('a zebra kick does not touch a shielded predator, and kicking ends the zebra\'s shield',()=>{
 const {p:z,q:lion,r}=setup('zebra','lion');
 // lion right behind the zebra (the zebra faces +x)
 Object.assign(lion,{x:z.x-12,y:z.y,protectedUntil:T+SPAWN_PROTECT_MS});z.protectedUntil=T+SPAWN_PROTECT_MS;
 useAbility(z,r,T+500);assert.equal(lion.stunUntil,0,'shielded lion was kicked');assert.equal(z.protectedUntil,T+SPAWN_PROTECT_MS,'a kick that hit nothing dropped the shield');
 lion.protectedUntil=0;z.abilityReady=0;useAbility(z,r,T+1000);assert.ok(lion.stunUntil>T+1000,'unshielded lion not kicked');assert.ok(z.protectedUntil<T+1000,'kicking kept the shield');
});
