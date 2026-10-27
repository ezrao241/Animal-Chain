import test from 'node:test';import assert from 'node:assert/strict';
import{move,newPlayer}from '../lib/game.ts';
test('restored movement brakes naturally after release',()=>{const p=newPlayer('p','P',1000,false,'lion');Object.assign(p,{x:1000,y:1000,dx:1,dy:0,vx:80,vy:0});p.dx=0;move(p,1/60,[],1000);assert.ok(p.vx>0&&p.vx<80);for(let i=0;i<180;i++)move(p,1/60,[],1000);assert.equal(p.vx,0);});
