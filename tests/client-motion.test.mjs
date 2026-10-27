import test from 'node:test';import assert from 'node:assert/strict';
import{advanceLocalMotion,reconcileLocal}from '../lib/client-motion.ts';import{newPlayer}from '../lib/game.ts';
const T=1800000000000;
function player(){const p=newPlayer('p','P',T,false,'lion');Object.assign(p,{x:1000,y:1000,dx:1,dy:0,vx:0,vy:0});return p;}
test('two slow frames simulate the same elapsed movement as sixty fast frames',()=>{const slow=player(),fast=structuredClone(slow);for(let i=1;i<=2;i++)advanceLocalMotion(slow,.5,[],T+i*500);for(let i=1;i<=60;i++)advanceLocalMotion(fast,1/60,[],T+i*1000/60);assert.ok(Math.abs(slow.x-fast.x)<.001);});
test('releasing movement stops even during charge and stale snapshots cannot drift the player',()=>{const p=player();p.abilityUntil=T+5000;advanceLocalMotion(p,.5,[],T+500);p.dx=0;const x=p.x;const server={...p,x:p.x+80,dx:1};for(let i=0;i<60;i++){advanceLocalMotion(p,1/60,[],T+600+i*16);reconcileLocal(p,server,.15,1/60);}assert.equal(p.x,x);assert.equal(p.vx,0);assert.equal(p.vy,0);});
