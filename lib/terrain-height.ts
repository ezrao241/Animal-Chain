import type {Prop} from './game.ts';
export function createTerrainHeight(ps:Prop[],W:number,H:number){
const S=40,X0=-1600,Z0=-1600,NX=Math.ceil((W+3200)/S)+1,NZ=Math.ceil((H+3200)/S)+1;
const WATERS=ps.filter(p=>p.kind==='water'),KOPJES=ps.filter(p=>p.kind==='rock'&&p.size>=1.3);
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function rolling(x:number,z:number){return 18*Math.sin(x*.0021+1.3)*Math.cos(z*.0017)+9*Math.sin(x*.0052+z*.0041)+4*Math.sin(x*.013-z*.011);}
/** surface height of each watering hole (the land around it is levelled to its centre, then dished) */
const waterLevel=(w:Prop)=>rolling(w.x,w.y)-4;
function height(x:number,z:number){
 let h=rolling(x,z);
 for(const w of WATERS){const d=Math.hypot(x-w.x,z-w.y);if(d<w.size*2.3){const c=rolling(w.x,w.y);h=c+(h-c)*smooth(w.size*1.2,w.size*2.2,d);const t=d/(w.size*1.35);if(t<1)h-=12*(1-t*t)**2;}}
 for(const k of KOPJES){const d=Math.hypot(x-k.x,z-k.y);if(d<230)h+=24*(1-smooth(0,230,d));}
 // outside the playable map the land rises into low hills that frame the horizon
 const out=Math.max(-x,x-W,-z,z-H,0);if(out>0)h+=smooth(0,1200,out)*140+Math.sin(x*.004)*Math.cos(z*.005)*30*smooth(0,600,out);
 return h;
}
let GRID:Float32Array|null=null;
function grid(){if(GRID)return GRID;GRID=new Float32Array(NX*NZ);for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++)GRID[j*NX+i]=height(X0+i*S,Z0+j*S);return GRID;}
/** Height of the faceted ground at (x, z) in game units, on the very triangle the renderer draws. */
function groundY(x:number,z:number){
 const g=grid(),fx=Math.min(Math.max((x-X0)/S,0),NX-1.001),fz=Math.min(Math.max((z-Z0)/S,0),NZ-1.001),i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,k=j*NX+i;
 const h00=g[k],h10=g[k+1],h01=g[k+NX],h11=g[k+NX+1];
 return u>=v?h00+(h10-h00)*u+(h11-h10)*v:h00+(h11-h01)*u+(h01-h00)*v;
}
return {groundY,grid,waterLevel};
}
