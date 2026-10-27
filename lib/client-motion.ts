import {move,type Player,type Prop} from './game.ts';
/** Advance all elapsed time in small physics steps, even when rendering is slow. */
export function advanceLocalMotion(p:Player,elapsed:number,ps:Prop[],now:number){
 const duration=Math.min(.5,Math.max(0,elapsed)),steps=Math.ceil(duration/(1/60));
 for(let i=0;i<steps;i++)move(p,duration/steps,ps,now-duration*1000+(i+1)*duration/steps*1000);
}
/** Never translate a stopped local animal toward a delayed moving snapshot. */
export function reconcileLocal(p:Player,server:Player,lag:number,dt:number){
 if(Math.hypot(p.dx,p.dy)<=.1)return;
 const tx=server.x+(server.vx||0)*lag,ty=server.y+(server.vy||0)*lag;
 const k=1-Math.exp(-3*dt);p.x+=(tx-p.x)*k;p.y+=(ty-p.y)*k;
}
