// Animal Chain: African savanna rules shared by the server, the offline practice build and the 3D client.
// 400 x 280 m playable map; 10 game units = 1 m. Animals are life-size.
export const W=4000,H=2800;
export const SPECIES=['lion','leopard','hyena','zebra','impala','warthog'] as const;
export type Species=typeof SPECIES[number];
export type FoodKind='grass'|'browse'|'roots'|'carrion';
type Animal={name:string;subtitle:string;speed:number;ability:string;duration:number;cooldown:number;prey:Species[];foods:FoodKind[];diet:string;tip:string;color:string;size:number;catchRange:number};
// size is shoulder height in metres. Predators only list prey they can realistically take alone: a leopard or a lone
// hyena does not bring down an adult zebra, and nothing here hunts a lion.
export const ANIMALS:Record<Species,Animal>={
 lion:{name:'Lion',subtitle:'Panthera leo · 190 kg',speed:205,ability:'Charge',duration:1.6,cooldown:9,prey:['zebra','impala','warthog'],foods:['carrion'],diet:'Zebra, impala, warthog & carrion',tip:'Charge closes the gap. Watch a zebra’s hind legs.',color:'#d9a54c',size:1.2,catchRange:26},
 leopard:{name:'Leopard',subtitle:'Panthera pardus · 60 kg',speed:210,ability:'Stalk',duration:4,cooldown:9,prey:['impala','warthog'],foods:['carrion'],diet:'Impala, warthog & carrion',tip:'Stalk unseen, or Q to climb an acacia and drop on prey below.',color:'#e0b25e',size:.7,catchRange:20},
 hyena:{name:'Spotted hyena',subtitle:'Crocuta crocuta · 60 kg',speed:200,ability:'Tireless',duration:6,cooldown:12,prey:['impala','warthog'],foods:['carrion'],diet:'Impala, warthog & any carcass',tip:'Outlast prey with Tireless. Every carcass is yours to clean up.',color:'#b99a6c',size:.8,catchRange:22},
 zebra:{name:'Plains zebra',subtitle:'Equus quagga · 300 kg',speed:220,ability:'Kick',duration:.6,cooldown:8,prey:[],foods:['grass'],diet:'Grasses',tip:'Kick stuns any predator right behind you.',color:'#ece6d6',size:1.35,catchRange:0},
 impala:{name:'Impala',subtitle:'Aepyceros melampus · 55 kg',speed:235,ability:'Leap',duration:1.2,cooldown:6,prey:[],foods:['grass','browse'],diet:'Grass & acacia browse',tip:'Leap clears a predator’s reach. Keep moving.',color:'#c98a4b',size:.85,catchRange:0},
 warthog:{name:'Warthog',subtitle:'Phacochoerus africanus · 75 kg',speed:185,ability:'Burrow',duration:5,cooldown:9,prey:[],foods:['grass','roots'],diet:'Grass, roots & bulbs',tip:'Back into a burrow to vanish. Dig up roots to eat.',color:'#8e7a6a',size:.7,catchRange:0},
};
export type Prop={x:number;y:number;kind:'tree'|'rock'|'bush'|'burrow'|'water';size:number};
export type Food={id:number;x:number;y:number;kind:string;ready:number;until?:number};
export type Player={id:string;token?:string;name:string;bot:boolean;species:Species;x:number;y:number;dx:number;dy:number;vx:number;vy:number;perched:boolean;perchHeight:number;actionUntil:number;lastSeen:number;inputAt:number;born:number;protectedUntil:number;deadUntil:number;abilityUntil:number;abilityReady:number;interactReady:number;stunUntil:number;hunger:number;score:number;deaths:number;food:number;hunts:number;drinks:number;scavenged:number;escapes:number;hiddenSeconds:number;survivalSeconds:number;claimed:boolean[];sprint:boolean;stamina:number;exhausted?:boolean;threatAt:number;face:number;message:string;messageUntil:number;seq:number;targetX:number;targetY:number};
export type Room={code:string;host:string;phase:'lobby'|'playing'|'finished';started:number;ends:number;tick:number;players:Player[];foods:Food[];events:string[];seed:number;round:number;practice?:boolean};
// Computer-controlled wildlife keeps savanna proportions: plenty of grazers, a few predators.
const WILDLIFE_MIX:Species[]=['impala','zebra','impala','warthog','zebra','impala','hyena','impala','warthog','zebra','lion','impala','warthog','zebra','leopard','impala','warthog','hyena','zebra','impala'];
export const WILDLIFE:Species[]=Array.from({length:60},(_,i)=>WILDLIFE_MIX[i%WILDLIFE_MIX.length]);
export function savannaEvent(room:Pick<Room,'started'>,now:number){const stage=Math.min(2,Math.floor(Math.max(0,now-room.started)/100000));return [
 {name:'GOLDEN GRAZE',detail:'Food is worth +2 extra points',kind:'forage',next:room.started+100000},
 {name:'THE HUNT',detail:'Successful hunts earn +5 extra points',kind:'hunt',next:room.started+200000},
 {name:'DUSK RUN',detail:'Escape a predator for double points',kind:'escape',next:room.started+300000}
 ][stage];}
export function cameraInput(dx:number,dy:number,yaw=0){return{dx:dx*Math.cos(yaw)+dy*Math.sin(yaw),dy:-dx*Math.sin(yaw)+dy*Math.cos(yaw)};}
export const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
export function rng(seed:number){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// Savanna layout, generated once from a fixed seed so server, offline build and renderer agree:
// four watering holes, rocky kopjes (each boulder is a collider), scattered umbrella-thorn acacias,
// thickets of tall grass and scrub to hide in, and old aardvark burrows that warthogs use.
let LAYOUT:Prop[]|null=null;
function layout():Prop[]{
 if(LAYOUT)return LAYOUT;const r=rng(417),out:Prop[]=[];
 const clear=(x:number,y:number,gap:number,kinds:Prop['kind'][])=>out.every(p=>!kinds.includes(p.kind)||dist(p,{x,y})>gap+(p.kind==='water'?p.size:0));
 for(const [x,y,s] of [[1180,860,250],[2900,700,210],[2350,1900,290],[700,2050,200]] as const)out.push({x,y,kind:'water',size:s});
 const kopjes:{x:number;y:number}[]=[];
 for(let n=0;kopjes.length<14&&n<500;n++){const x=260+r()*(W-520),y=260+r()*(H-520);if(clear(x,y,180,['water'])&&kopjes.every(k=>dist(k,{x,y})>520))kopjes.push({x,y});}
 for(const k of kopjes){const count=4+Math.floor(r()*5);for(let i=0;i<count;i++){const a=r()*Math.PI*2,d=i?35+r()*85:0,size=i?.6+r()*.7:1.3+r()*.5;out.push({x:k.x+Math.cos(a)*d,y:k.y+Math.sin(a)*d,kind:'rock',size});}}
 for(let n=0;out.filter(p=>p.kind==='tree').length<118&&n<4000;n++){
  // acacias favour the lower ground around water and the foot of kopjes
  let x=120+r()*(W-240),y=120+r()*(H-240);if(r()<.35){const anchor=out[Math.floor(r()*out.length)];x=anchor.x+(r()-.5)*600;y=anchor.y+(r()-.5)*600;}
  if(x<100||y<100||x>W-100||y>H-100)continue;
  if(clear(x,y,60,['water'])&&clear(x,y,70,['rock'])&&clear(x,y,110,['tree']))out.push({x,y,kind:'tree',size:.8+r()*.55});
 }
 for(let n=0;out.filter(p=>p.kind==='bush').length<150&&n<4000;n++){
  const x=90+r()*(W-180),y=90+r()*(H-180);
  if(clear(x,y,30,['water'])&&clear(x,y,55,['rock'])&&clear(x,y,35,['tree'])&&clear(x,y,90,['bush']))out.push({x,y,kind:'bush',size:.8+r()*.6});
 }
 for(let n=0;out.filter(p=>p.kind==='burrow').length<28&&n<4000;n++){
  const x=150+r()*(W-300),y=150+r()*(H-300);
  if(clear(x,y,80,['water'])&&clear(x,y,60,['rock','tree'])&&clear(x,y,40,['bush'])&&clear(x,y,300,['burrow']))out.push({x,y,kind:'burrow',size:1});
 }
 return LAYOUT=out;
}
export function props(seed:number):Prop[]{return layout();}
export const solid=(t:Prop)=>t.kind==='tree'||t.kind==='rock';
/** collision radius of a solid prop in game units: a boulder by its size, an acacia by its trunk */
export const solidRadius=(t:Prop)=>t.kind==='rock'?t.size*32:TRUNK_RADIUS;
// Uniform grid over the solid props so collision and steering checks only look at nearby trunks and rocks.
// Results keep the table's order, so collisions resolve exactly as a scan over the whole table would.
const CELL=100,gridCache=new WeakMap<Prop[],Map<number,number[]>>();
const cellKey=(cx:number,cy:number)=>cy*1000+cx;
function solidGrid(ps:Prop[]){let g=gridCache.get(ps);if(g)return g;g=new Map();ps.forEach((t,i)=>{if(!solid(t))return;const k=cellKey(Math.floor(t.x/CELL),Math.floor(t.y/CELL));let c=g!.get(k);if(!c)g!.set(k,c=[]);c.push(i);});gridCache.set(ps,g);return g;}
const bushCache=new WeakMap<Prop[],Map<number,Prop[]>>();
/** True when a thicket stands within `range` units of (x, y); range must not exceed one grid cell. */
function bushNear(ps:Prop[],x:number,y:number,range:number){let g=bushCache.get(ps);if(!g){g=new Map();for(const t of ps)if(t.kind==='bush'){const k=cellKey(Math.floor(t.x/CELL),Math.floor(t.y/CELL));let c=g.get(k);if(!c)g.set(k,c=[]);c.push(t);}bushCache.set(ps,g);}const cx=Math.floor(x/CELL),cy=Math.floor(y/CELL);for(let j=cy-1;j<=cy+1;j++)for(let i=cx-1;i<=cx+1;i++){const c=g.get(cellKey(i,j));if(c)for(const t of c)if(Math.hypot(x-t.x,y-t.y)<range*t.size)return true;}return false;}
/** Solid props (acacias, boulders) within `range` units of (x, y), plus a few just outside it, in table order. */
export function solidNear(ps:Prop[],x:number,y:number,range:number):Prop[]{const g=solidGrid(ps),ids:number[]=[];const x0=Math.floor((x-range)/CELL),x1=Math.floor((x+range)/CELL),y0=Math.floor((y-range)/CELL),y1=Math.floor((y+range)/CELL);for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){const c=g.get(cellKey(cx,cy));if(c)ids.push(...c);}return ids.sort((a,b)=>a-b).map(i=>ps[i]);}
export const nearWater=(ps:Prop[],x:number,y:number,margin=0)=>ps.some(t=>t.kind==='water'&&dist(t,{x,y})<t.size+margin);
const blocked=(ps:Prop[],x:number,y:number,gap:number)=>ps.some(t=>solid(t)&&dist(t,{x,y})<solidRadius(t)+gap)||nearWater(ps,x,y,gap*.5);
// Food: fresh grass on open ground, acacia browse under trees, roots and bulbs, and old carcasses.
export function makeFoods(seed:number):Food[]{const r=rng(seed+111),ps=props(seed),trees=ps.filter(t=>t.kind==='tree');return Array.from({length:560},(_,id)=>{const kind=(['grass','grass','browse','roots','grass','carrion','roots','browse','grass','grass'] as const)[id%10];let x=0,y=0;for(let n=0;n<35;n++){if(kind==='browse'){const t=trees[Math.floor(r()*trees.length)],a=r()*Math.PI*2,d=25+r()*35;x=t.x+Math.cos(a)*d;y=t.y+Math.sin(a)*d;}else{x=65+r()*(W-130);y=65+r()*(H-130);}if(!blocked(ps,x,y,30))break;}return{id,x,y,kind,ready:0};});}
export function safePoint(seed:number):{x:number;y:number}{const r=rng(seed),ps=props(417);for(let i=0;i<30;i++){const q={x:100+r()*(W-200),y:100+r()*(H-200)};if(!blocked(ps,q.x,q.y,40))return q;}return{x:W/2,y:H/2};}
export function newPlayer(id:string,name:string,now:number,bot=false,species?:Species):Player{const p={id,name,bot,species:species||SPECIES[Math.floor(Math.random()*6)],...safePoint(Math.floor(Math.random()*1e6)),dx:0,dy:0,vx:0,vy:0,perched:false,perchHeight:0,actionUntil:0,lastSeen:now,inputAt:now,born:now,protectedUntil:now+4000,deadUntil:0,abilityUntil:0,abilityReady:0,interactReady:0,stunUntil:0,hunger:100,score:0,deaths:0,food:0,hunts:0,drinks:0,scavenged:0,escapes:0,hiddenSeconds:0,survivalSeconds:0,claimed:[false,false,false],sprint:false,stamina:100,threatAt:0,face:1,message:'A new place in the chain.',messageUntil:now+3000,seq:0,targetX:0,targetY:0};return p;}
export function newRoom(code:string,host:Player,now:number):Room{return{code,host:host.id,phase:'lobby',started:0,ends:0,tick:now,players:[host],foods:makeFoods(417),events:['Welcome to the Golden Plains.'],seed:417,round:0};}
export function notify(p:Player,message:string,now:number){p.message=message;p.messageUntil=now+2500;}
export function respawn(p:Player,now:number){const choices=SPECIES.filter(s=>s!==p.species);const species=p.bot?(WILDLIFE[Number(p.id.replace('wild-',''))]||p.species):choices[Math.floor(Math.random()*choices.length)];const fresh=newPlayer(p.id,p.bot?ANIMALS[species].name:p.name,now,p.bot,species);Object.assign(p,fresh,{score:p.score,deaths:p.deaths,token:p.token,lastSeen:p.lastSeen,seq:p.seq});notify(p,'New life. New animal.',now);}
export function start(room:Room,now:number){room.phase='playing';room.started=now;room.ends=now+300000;room.tick=now;room.round++;room.foods=makeFoods(room.seed);room.players=room.players.filter(p=>!p.bot);for(const p of room.players){const token=p.token,choices=SPECIES.filter(s=>s!==p.species);Object.assign(p,newPlayer(p.id,p.name,now,false,choices[Math.floor(Math.random()*choices.length)]),{token});}WILDLIFE.forEach((s,i)=>room.players.push(newPlayer('wild-'+i,ANIMALS[s].name,now,true,s)));room.events=['Golden graze. Find food, complete tasks, survive.'];}
export const leaping=(p:Player,now:number)=>p.species==='impala'&&p.abilityUntil>now;
// Hidden: a leopard up a tree or stalking, a warthog in its burrow, or anyone but a zebra standing still in a thicket.
export function hidden(p:Player,room:Room,now:number){return p.species==='leopard'&&(p.perched||p.abilityUntil>now)||p.species==='warthog'&&p.abilityUntil>now||p.species!=='zebra'&&Math.hypot(p.dx,p.dy)<.1&&bushNear(props(room.seed),p.x,p.y,45);}
// Speeds keep the species balance of the design, scaled to real running speeds (impala 9.4 m/s, 13.3 m/s sprinting).
export const REAL_SPEED=.4,TRUNK_RADIUS=7,POUNCE_RANGE=42,AMBUSH_RANGE=60,KICK_RANGE=40,FOOD_RANGE=18,BURROW_REACH=45,TREE_REACH=40,WATER_REACH=30;
export function move(p:Player,dt:number,ps:Prop[],now:number){
 p.vx??=0;p.vy??=0;p.stamina??=100;
 if(p.perched||p.species==='warthog'&&p.abilityUntil>now||(p.stunUntil??0)>now){p.vx=0;p.vy=0;return;}
 let speed=ANIMALS[p.species].speed;
 if(p.abilityUntil>now)speed*=p.species==='lion'?1.9:p.species==='impala'?2.2:p.species==='leopard'?.6:p.species==='hyena'?1.15:1;
 const tireless=p.species==='hyena'&&p.abilityUntil>now;
 const sprinting=p.sprint&&(tireless||!p.exhausted&&p.stamina>0)&&Math.hypot(p.dx,p.dy)>.1;speed*=(sprinting?1.42:1)*REAL_SPEED;
 const n=Math.max(1,Math.hypot(p.dx,p.dy)),blend=1-Math.exp(-(p.species==='zebra'||p.species==='lion'?12:18)*dt);
 p.vx+=(p.dx/n*speed-p.vx)*blend;p.vy+=(p.dy/n*speed-p.vy)*blend;
 if(Math.abs(p.vx)<.1)p.vx=0;if(Math.abs(p.vy)<.1)p.vy=0;
 let x=Math.max(25,Math.min(W-25,p.x+p.vx*dt)),y=Math.max(25,Math.min(H-25,p.y+p.vy*dt));
 for(const t of solidNear(ps,x,y,126)){const radius=solidRadius(t);
 const d=Math.hypot(x-t.x,y-t.y);if(d<radius){const nx=d>.001?(x-t.x)/d:1,ny=d>.001?(y-t.y)/d:0;x=t.x+nx*radius;y=t.y+ny*radius;const inward=p.vx*nx+p.vy*ny;if(inward<0){p.vx-=inward*nx;p.vy-=inward*ny;}}}
 p.x=x;p.y=y;if(Math.abs(p.vx)>1)p.face=p.vx>0?1:-1;
}
const nearestTree=(p:Player,room:Room)=>props(room.seed).filter(t=>t.kind==='tree'&&dist(p,t)<TREE_REACH).sort((a,b)=>dist(a,p)-dist(b,p))[0];
/** Q: a leopard climbs into (or jumps down from) the nearest acacia. */
export function perch(p:Player,room:Room,now:number){
 if(p.species!=='leopard'||p.deadUntil)return;
 if(p.perched){p.perched=false;p.perchHeight=0;p.abilityReady=Math.max(p.abilityReady,now+600);notify(p,'Down from the tree.',now);return;}
 const tree=nearestTree(p,room);
 if(!tree){notify(p,'Move closer to an acacia, then press Q to climb.',now);return;}
 p.perched=true;p.x=tree.x+8;p.y=tree.y;p.perchHeight=tree.size*30;p.dx=0;p.dy=0;p.vx=0;p.vy=0;notify(p,'Hidden in the acacia. E drops onto prey below.',now);
}
export function useAbility(p:Player,room:Room,now:number){if(now<p.abilityReady||p.deadUntil)return;
 if(p.species==='leopard'&&p.perched){notify(p,'Press Q to climb down first.',now);return;}
 if(p.species==='warthog'){const burrow=props(room.seed).filter(t=>t.kind==='burrow'&&dist(t,p)<BURROW_REACH).sort((a,b)=>dist(a,p)-dist(b,p))[0];if(!burrow){notify(p,'Find a burrow first: a dark hole in open ground.',now);return;}p.x=burrow.x;p.y=burrow.y;p.dx=0;p.dy=0;}
 if(p.species==='zebra'){const kicked=room.players.filter(q=>!q.deadUntil&&ANIMALS[q.species].prey.includes('zebra')&&dist(q,p)<KICK_RANGE);for(const q of kicked){q.stunUntil=now+2500;const d=Math.max(1,dist(q,p));q.x=Math.max(25,Math.min(W-25,q.x+(q.x-p.x)/d*20));q.y=Math.max(25,Math.min(H-25,q.y+(q.y-p.y)/d*20));notify(q,'Kicked by a zebra! Stunned.',now);}if(kicked.length){p.score+=4;notify(p,'Kick landed +4',now);}}
 if(p.species==='hyena')p.stamina=100,p.exhausted=false;
 p.abilityUntil=now+ANIMALS[p.species].duration*1000;p.abilityReady=now+ANIMALS[p.species].cooldown*1000;if(p.species!=='zebra')notify(p,ANIMALS[p.species].ability+'!',now);}
export function die(p:Player,room:Room,now:number,cause:string){if(p.deadUntil)return;p.deadUntil=now+2600;p.dx=0;p.dy=0;p.vx=0;p.vy=0;p.perched=false;p.deaths++;notify(p,cause,now);if(!p.bot){room.events.unshift(p.name+' '+cause);room.events=room.events.slice(0,5);}}
// A kill leaves a carcass for scavengers once the hunter has eaten. Old carcasses dry out.
function dropCarcass(room:Room,x:number,y:number,now:number){room.foods=room.foods.filter(f=>!f.until||f.until>now);if(room.foods.length>620)return;const id=Math.max(0,...room.foods.map(f=>f.id))+1;room.foods.push({id,x,y,kind:'carrion',ready:now+5000,until:now+90000});}
export function interact(p:Player,room:Room,now:number){if(p.deadUntil||now<p.interactReady)return;p.interactReady=now+650;p.actionUntil=now+500;
 if(p.stunUntil>now){notify(p,'Still stunned.',now);return;}
 const a=ANIMALS[p.species],ambush=p.species==='leopard'&&p.perched;
 const reach=ambush?AMBUSH_RANGE:p.abilityUntil>now&&(p.species==='lion'||p.species==='leopard')?POUNCE_RANGE:a.catchRange;
 const victims=room.players.filter(q=>q.id!==p.id&&!q.deadUntil&&q.protectedUntil<now&&a.prey.includes(q.species)&&!hidden(q,room,now)&&!leaping(q,now)&&dist(p,q)<reach);victims.sort((x,y)=>dist(p,x)-dist(p,y));
 if(victims[0]){const q=victims[0];if(ambush){p.perched=false;p.perchHeight=0;}p.x=q.x-(q.x-p.x)*.3;p.y=q.y-(q.y-p.y)*.3;die(q,room,now,'was caught by a '+a.name.toLowerCase()+'.');dropCarcass(room,q.x,q.y,now);p.hunger=Math.min(100,p.hunger+45);p.hunts++;p.food++;const points=(savannaEvent(room,now).kind==='hunt'?15:10)+(ambush?3:0);p.score+=points;notify(p,(ambush?'Ambush! ':'Successful hunt ')+'+'+points,now);return;}
 if(ambush){notify(p,'No prey below. Wait for it to come closer.',now);return;}
 const f=room.foods.filter(f=>f.ready<=now&&(!f.until||f.until>now)&&(a.foods as string[]).includes(f.kind)&&dist(p,f)<FOOD_RANGE).sort((x,y)=>dist(p,x)-dist(p,y))[0];
 if(f){if(f.until)f.until=now;else f.ready=now+18000;p.food++;if(f.kind==='carrion')p.scavenged++;p.hunger=Math.min(100,p.hunger+(f.kind==='carrion'?35:28));const points=(savannaEvent(room,now).kind==='forage'?5:3)+(f.kind==='carrion'&&p.species==='hyena'?2:0);p.score+=points;notify(p,(f.kind==='carrion'?'Scavenged ':f.kind==='roots'?'Dug up roots ':'Food found ')+'+'+points,now);return;}
 if(nearWater(props(room.seed),p.x,p.y,WATER_REACH)){p.drinks++;p.hunger=Math.min(100,p.hunger+6);p.score+=2;notify(p,'A long drink +2',now);return;}
 if(!p.bot)notify(p,'Move closer to your food, water or suitable prey.',now);
}
type Task={label:string;value:number;target:number;points:number};
export function tasks(p:Player,now:number):Task[]{
 const survive={label:'Survive this life for 60 seconds',value:Math.floor(p.survivalSeconds),target:60,points:40};
 const hunts=(target:number)=>({label:`Complete ${target} hunt${target>1?'s':''}`,value:p.hunts,target,points:30});
 const graze=(label:string)=>({label,value:p.food,target:4,points:30});
 const drink={label:'Drink at a watering hole',value:p.drinks,target:1,points:25};
 const hide=(label:string)=>({label,value:Math.floor(p.hiddenSeconds),target:8,points:25});
 const second:Record<Species,[Task,Task]>={
  lion:[hunts(2),drink],
  leopard:[hunts(2),hide('Stay hidden for 8 seconds')],
  hyena:[hunts(1),{label:'Scavenge 3 carcasses',value:p.scavenged,target:3,points:25}],
  zebra:[graze('Graze 4 times'),drink],
  impala:[graze('Eat 4 food items'),{label:'Escape 2 predators',value:p.escapes,target:2,points:25}],
  warthog:[graze('Root out 4 food items'),hide('Hide in a burrow or thicket for 8 s')],
 };
 return[...second[p.species],survive];
}
export function tick(room:Room,now:number){
 for(const p of room.players){p.vx??=0;p.vy??=0;p.sprint??=false;p.stamina??=100;p.perched??=false;p.perchHeight??=0;p.actionUntil??=0;p.survivalSeconds??=0;p.stunUntil??=0;p.drinks??=0;p.scavenged??=0;}
 if(room.started&&room.ends-room.started>300000)room.ends=room.started+300000;
 if(room.phase!=='playing'){room.tick=now;return;}
 const total=Math.min(1.5,Math.max(0,(Math.min(now,room.ends)-room.tick)/1000)),ps=props(room.seed),steps=Math.ceil(total/.1);
 for(let s=0;s<steps;s++){
 const dt=total/steps,t=Math.min(now,room.ends)-(steps-1-s)*dt*1000;
 for(const p of room.players){
 if(!p.bot&&t-p.lastSeen>8000){p.dx=0;p.dy=0;continue;}
 if(p.deadUntil){if(t>=p.deadUntil)respawn(p,t);continue;}
 if(p.bot)steer(p,room,ps,t);
 else if(t-p.inputAt>800){p.dx=0;p.dy=0;}
 const tireless=p.species==='hyena'&&p.abilityUntil>t,canMove=!(p.perched||p.species==='warthog'&&p.abilityUntil>t||p.stunUntil>t);
 const sprinting=p.sprint&&!p.exhausted&&Math.hypot(p.dx,p.dy)>.1&&canMove;
 move(p,dt,ps,t);p.stamina=Math.max(0,Math.min(100,p.stamina+(tireless?18:sprinting?-26:18)*dt));
 if(p.stamina<=.5)p.exhausted=true;else if(p.stamina>=25)p.exhausted=false;
 p.survivalSeconds+=dt;p.hunger-=dt*.6;
 if(p.hunger<=0){die(p,room,t,'ran out of food.');continue;}
 if(hidden(p,room,t))p.hiddenSeconds+=dt;
 const threat=room.players.some(q=>!q.deadUntil&&ANIMALS[q.species].prey.includes(p.species)&&dist(p,q)<200);
 if(threat)p.threatAt=t;else if(p.threatAt&&t-p.threatAt>3000){p.escapes++;const points=savannaEvent(room,t).kind==='escape'?10:5;p.score+=points;p.threatAt=0;notify(p,'Escaped a threat +'+points,t);}
 tasks(p,t).forEach((task,i)=>{if(!p.claimed[i]&&task.value>=task.target){p.claimed[i]=true;p.score+=task.points;notify(p,'Task complete +'+task.points,t);}});
 }}room.tick=now;if(now>=room.ends){room.phase='finished';room.players.forEach(p=>{p.dx=0;p.dy=0;p.vx=0;p.vy=0;});room.events.unshift('Round complete. Every life counted.');}}
// Wildlife behaviour: flee predators (using the species' escape trick), hunt or forage when hungry, otherwise wander.
function steer(p:Player,room:Room,ps:Prop[],t:number){
 const a=ANIMALS[p.species];
 const danger=room.players.filter(q=>!q.deadUntil&&ANIMALS[q.species].prey.includes(p.species)&&dist(q,p)<200&&!hidden(q,room,t)).sort((x,y)=>dist(x,p)-dist(y,p))[0];
 let goal:{x:number;y:number}|undefined;
 if(p.perched){const below=room.players.some(q=>!q.deadUntil&&a.prey.includes(q.species)&&dist(q,p)<AMBUSH_RANGE);if(below)interact(p,room,t);else if(p.hunger<55||Math.random()<.002)perch(p,room,t);p.dx=0;p.dy=0;return;}
 if(danger){
  goal={x:Math.max(50,Math.min(W-50,p.x+(p.x-danger.x)*3)),y:Math.max(50,Math.min(H-50,p.y+(p.y-danger.y)*3))};
  const d=dist(danger,p);p.sprint=true;
  if(t>p.abilityReady&&(p.species==='zebra'?d<KICK_RANGE:p.species==='impala'?d<90:p.species==='warthog'||d<120))useAbility(p,room,t);
 }else{
  p.sprint=false;
  if(p.hunger<90&&a.prey.length){const prey=room.players.filter(q=>!q.deadUntil&&q.protectedUntil<t&&a.prey.includes(q.species)&&dist(q,p)<450&&!hidden(q,room,t)).sort((x,y)=>dist(p,x)-dist(p,y))[0];if(prey){goal=prey;const d=dist(p,prey);p.sprint=d<180;if(t>p.abilityReady&&(p.species==='lion'&&d<70||p.species==='hyena'&&d<200||p.species==='leopard'&&d>60&&d<160))useAbility(p,room,t);}}
  if(!goal&&p.species==='leopard'&&p.hunger>75&&t>p.abilityReady&&nearestTree(p,room)){perch(p,room,t);return;}
  if(!goal){let best=Infinity;for(const f of room.foods){if(f.ready>t||f.until&&f.until<t||!(a.foods as string[]).includes(f.kind))continue;const d=dist(p,f);if(d<best){best=d;goal=f;}}}
 }
 if(!goal){if(!p.targetX||dist(p,{x:p.targetX,y:p.targetY})<60){const q=safePoint(Math.floor(t+p.x));p.targetX=q.x;p.targetY=q.y;}goal={x:p.targetX,y:p.targetY};}
 const d=dist(p,goal);p.dx=d>8?(goal.x-p.x)/Math.max(1,d):0;p.dy=d>8?(goal.y-p.y)/Math.max(1,d):0;
 // Steer around trunks and boulders before collision instead of running into them forever.
 for(const tree of solidNear(ps,p.x,p.y,90)){
  const ox=tree.x-p.x,oy=tree.y-p.y,clearance=solidRadius(tree)+18;
  if(Math.hypot(ox,oy)<clearance&&ox*p.dx+oy*p.dy>0){
   const side=p.dx*oy-p.dy*ox>=0?-1:1,angle=side*.9;
   const dx=p.dx*Math.cos(angle)-p.dy*Math.sin(angle);p.dy=p.dx*Math.sin(angle)+p.dy*Math.cos(angle);p.dx=dx;break;
  }
 }
 if(p.hunger<90||!a.prey.length)interact(p,room,t);
}
export function publicRoom(room:Room,now:number){return{...room,players:room.players.map(({token,...p})=>({...p,online:p.bot||now-p.lastSeen<8000,concealed:hidden(p,room,now)})),serverTime:now};}
