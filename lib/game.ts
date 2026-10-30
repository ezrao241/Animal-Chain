// Animal Chain: African savanna rules shared by the server, the offline practice build and the 3D client.
// 400 x 280 m playable map; 10 game units = 1 m. Animals are life-size.
import {tree,limbPoint,type Tree} from './acacia.ts';
import type {BadgeId} from './rewards.ts';
export const W=4000,H=2800;
export const SPECIES=['lion','leopard','hyena','zebra','impala','warthog'] as const;
export type Species=typeof SPECIES[number];
export type FoodKind='grass'|'browse'|'roots'|'carrion';
/** Locomotion in metres and seconds: walking, cruising and top speed; accel (speeding up), brake (slowing down) and
 *  grip (sideways acceleration, which sets the turning circle a = v²/r), all in m/s²; turnRate, how fast the body swings
 *  round to face a new heading (rad/s, display only); how long the sprint lasts and how long a full recovery takes;
 *  where the trot and gallop begin (big cats walk straight into a gallop, they don't trot).
 *  Grip and brake are set at 1.3-2.4 g, a little above what the real animals sustain, so steering feels immediate;
 *  the order between species is kept (impala and leopard nimblest, zebra heaviest). */
export type Gait={walk:number;run:number;sprint:number;accel:number;grip:number;brake:number;turnRate:number;sprintTime:number;recover:number;trot:number;gallop:number};
type Animal={name:string;subtitle:string;gait:Gait;ability:string;duration:number;cooldown:number;prey:Species[];foods:FoodKind[];diet:string;tip:string;color:string;size:number;catchRange:number;sight:number;style:string;threat:string;defense:string};
// size is shoulder height in metres. sight is how far (game units, at full conspicuousness) the animal notices others. Speeds: lion 80 km/h for a few seconds, leopard 58, hyena 60 but for kilometres,
// zebra 65, impala 75 with 10 m bounds, warthog 48. Predators only list prey they can realistically take alone: a leopard or a lone
// hyena does not bring down an adult zebra, and nothing here hunts a lion.
export const ANIMALS:Record<Species,Animal>={
 lion:{name:'Lion',subtitle:'Panthera leo · 190 kg',gait:{walk:1.4,run:8,sprint:22,accel:9.5,grip:16,brake:15,turnRate:7,sprintTime:9,recover:30,trot:Infinity,gallop:4.5},ability:'Charge',duration:1.6,cooldown:9,prey:['zebra','impala','warthog'],foods:['carrion'],diet:'Zebra, impala, warthog & carrion',tip:'Charge closes the gap. Watch a zebra’s hind legs. Q scrambles into a low, thick bough.',color:'#d9a54c',size:1.2,catchRange:26,sight:240,style:'Ambush and short charge',threat:'Nothing hunts you, but a zebra kick stuns you',defense:'Size: no predator here takes a lion'},
 leopard:{name:'Leopard',subtitle:'Panthera pardus · 60 kg',gait:{walk:1.2,run:8,sprint:16.5,accel:9,grip:20,brake:16,turnRate:10,sprintTime:10,recover:25,trot:Infinity,gallop:4},ability:'Stalk',duration:4,cooldown:9,prey:['impala','warthog'],foods:['carrion'],diet:'Impala, warthog & carrion',tip:'Stalk unseen, or Q to climb an acacia and drop on prey below.',color:'#e0b25e',size:.7,catchRange:20,sight:250,style:'Stalker and tree ambusher',threat:'Nothing hunts you; prey spots you if you rush',defense:'Climb an acacia (Q) to vanish into the canopy'},
 hyena:{name:'Spotted hyena',subtitle:'Crocuta crocuta · 60 kg',gait:{walk:1.3,run:6.5,sprint:17,accel:6,grip:15,brake:13,turnRate:8,sprintTime:45,recover:12,trot:2.2,gallop:7},ability:'Tireless',duration:6,cooldown:12,prey:['impala','warthog','zebra'],foods:['carrion'],diet:'Impala, warthog, zebra (as a clan) & any carcass',tip:'Outlast prey with Tireless. A zebra needs the clan: hunt it with two more hyenas close by.',color:'#b99a6c',size:.8,catchRange:22,sight:230,style:'Endurance chaser and scavenger',threat:'Nothing hunts you; prey outruns a short chase',defense:'Tireless refills stamina for a long pursuit'},
 zebra:{name:'Plains zebra',subtitle:'Equus quagga · 300 kg',gait:{walk:1.6,run:7,sprint:18,accel:7,grip:13,brake:9,turnRate:6,sprintTime:30,recover:15,trot:2.6,gallop:8},ability:'Kick',duration:.6,cooldown:8,prey:[],foods:['grass'],diet:'Grasses',tip:'Kick stuns any predator right behind you.',color:'#ece6d6',size:1.35,catchRange:0,sight:260,style:'Herd watcher with a defensive kick',threat:'Lions and hyena clans',defense:'Kick a predator that is right behind you'},
 impala:{name:'Impala',subtitle:'Aepyceros melampus · 55 kg',gait:{walk:1.4,run:7.8,sprint:16.2,accel:7,grip:24,brake:18,turnRate:12,sprintTime:18,recover:14,trot:2.4,gallop:6},ability:'Leap',duration:.9,cooldown:6,prey:[],foods:['grass','browse'],diet:'Grass & acacia browse',tip:'Leap clears a predator’s reach. Keep moving.',color:'#c98a4b',size:.85,catchRange:0,sight:280,style:'Alert sprinter, sharp turns and leaps',threat:'Lions, leopards and hyenas',defense:'Leap clear of a catch at the last moment'},
 warthog:{name:'Warthog',subtitle:'Phacochoerus africanus · 75 kg',gait:{walk:1.2,run:5.5,sprint:13,accel:6.5,grip:18,brake:15,turnRate:10,sprintTime:14,recover:14,trot:2,gallop:6},ability:'Burrow',duration:5,cooldown:9,prey:[],foods:['grass','roots'],diet:'Grass, roots & bulbs',tip:'Back into a burrow to vanish. Dig up roots to eat.',color:'#8e7a6a',size:.7,catchRange:0,sight:170,style:'Burrow escape artist',threat:'Lions, leopards and hyenas',defense:'Back into a burrow to become uncatchable'},
};
export type Prop={x:number;y:number;kind:'tree'|'rock'|'bush'|'burrow'|'water'|'tallgrass';size:number};
/** What a computer-controlled animal is doing right now; the client poses the animal to match. */
export type Mood='graze'|'rest'|'drink'|'watch'|'flee'|'regroup'|'patrol'|'stalk'|'chase'|'wander';
export type Food={id:number;x:number;y:number;kind:string;ready:number;until?:number};
export type Player={id:string;token?:string;name:string;bot:boolean;species:Species;x:number;y:number;dx:number;dy:number;vx:number;vy:number;perched:boolean;perchHeight:number;actionUntil:number;lastSeen:number;inputAt:number;born:number;protectedUntil:number;deadUntil:number;abilityUntil:number;abilityReady:number;interactReady:number;stunUntil:number;hunger:number;score:number;deaths:number;food:number;hunts:number;drinks:number;scavenged:number;escapes:number;hiddenSeconds:number;survivalSeconds:number;claimed:boolean[];sprint:boolean;stamina:number;exhausted?:boolean;threatAt:number;face:number;message:string;messageUntil:number;seq:number;targetX:number;targetY:number;heading:number;mood:Mood;alert:number;targetId:string;moodUntil:number;alarmAt:number;calledAt:number;threatX:number;threatY:number;lastThreatAt:number;homeX:number;homeY:number;herd:string;nextDrink:number;chaseStart:number;thinkAt:number;stuckX:number;stuckY:number;stuckAt:number;unstickUntil:number;
 /** climbing (see climbStep): which prop, the state, height on the trunk and the face climbed, the limb, how far out
  *  along it and which way the animal faces on it, the limb it is heading for (-1 = down), the mount progress, and
  *  vertical speed while jumping down. Optional so rooms saved before climbing existed still load. */
 /** the species still to come for a human player, so every animal comes up once in each run of six lives */
 bag?:Species[];
 /** client-reported movement (lib/net.ts claim): the last accepted position, when and in which life, the banked jitter
  *  allowance, and how many reported positions the server has refused (the device then rejoins the server's animal) */
 anchorX?:number; anchorY?:number; anchorAt?:number; anchorBorn?:number; slack?:number; fix?:number;
 feeding?:{until:number;duration:number;last:number};
 /** water, 100 = just drunk; it runs down on its own, separately from food */
 thirst?:number;
 /** a committed catch attempt: the prey it is aimed at and when the lunge lands (or a leopard's leap, on landing) */
 strikeId?:string;strikeAt?:number;strikeAmbush?:boolean;
 /** the life (born time) a strike was committed in: a strike never carries over into a new life */
 strikeBorn?:number;strikeTargetBorn?:number;
 /** the line the lunge was launched along */
 strikeDir?:number;
 /** species tasks already rewarded this round ('zebra:1'): a new life doesn't pay the same task twice */
 done?:string[];
 /** this round's lives so far, for the death card and the end-of-round recap; lifeStart is the score a life began on */
 lives?:LifeRecord[];lifeStart?:number;
 /** food and water carried over a voluntary restart */
 carry?:{hunger:number;thirst:number};
 /** whole minutes this life has been paid for staying alive */
 survived?:number;
 /** the last one-shot action id processed for this player (lib/net.ts applyActions), so retries never run twice */
 act?:number;
 /** badges earned this round (lib/rewards.ts), for the player's own progress; the chosen coat colour per species (one
  *  digit each in SPECIES order, lib/rewards.ts coatCode), which everyone sees */
 badges?:string[];coats?:string;
 /** a player's chosen posture: crouched (creeping, low and harder to spot) or lying down (still, resting) */
 posture?:Posture;
 /** world events: a migrating zebra's lane (x at the south edge, x at the north edge); seconds spent in flames this
  *  life (a short dash through a thin front is survivable); seconds a zebra player has run with the migration */
 lane?:[number,number];scorch?:number;smokeUntil?:number;trekked?:number;
 tree?:number;climb?:Climb;ch?:number;side?:number;limb?:number;along?:number;limbDir?:number;goal?:number;mount?:number;climbHold?:number;vh?:number};
/** one finished life: what it was, how long it lasted, what it earned and how it ended */
export type LifeRecord={species:Species;seconds:number;points:number;food:number;hunts:number;cause:string};
export type Room={code:string;host:string;phase:'lobby'|'playing'|'finished';started:number;ends:number;tick:number;players:Player[];foods:Food[];events:string[];seed:number;round:number;practice?:boolean;duration?:300|600|0;/** set when the host ended the round early (or ended an unlimited round) */endedBy?:'host';rs?:number;/** migrating zebra already sent onto the plains for the day's migration */trek?:{day:number;n:number}};
// Computer-controlled wildlife keeps savanna proportions: plenty of grazers, a few predators.
const WILDLIFE_MIX:Species[]=['impala','zebra','impala','warthog','zebra','impala','hyena','impala','warthog','zebra','lion','impala','warthog','zebra','leopard','lion','warthog','hyena','zebra','impala'];
export const WILDLIFE:Species[]=Array.from({length:60},(_,i)=>WILDLIFE_MIX[i%WILDLIFE_MIX.length]);
// the three 100 s phases repeat in rounds longer than five minutes (10 minutes, unlimited); a 5-minute round sees each once
export function savannaEvent(room:Pick<Room,'started'>,now:number){const k=Math.floor(Math.max(0,now-room.started)/100000),next=room.started+(k+1)*100000;return [
 {name:'GOLDEN GRAZE',detail:'Food is worth +2 extra points',kind:'forage',next},
 {name:'THE HUNT',detail:'Successful hunts earn +5 extra points',kind:'hunt',next},
 {name:'DAWN RUN',detail:'Escape a predator for double points',kind:'escape',next}
 ][k%3];}
/** Day and night. Every round opens at 10:00 and a whole savanna day passes in DAY_MS (5 real minutes: a game
 *  compression), so the bonus phases fall at their natural times: Golden graze 10:00–18:00, the Hunt 18:00–02:00 in the
 *  dark, Dawn run 02:00–10:00. The sun takes its real path for 2.3° S in late June (computed below: it rises about 06:04
 *  and sets about 17:56 local solar time); docs/wildlife-sources.md has what is fact and what is game rule. */
export const DAY_MS=300000,DAY_START=10,LATITUDE=-2.3,DECLINATION=23.4;
/** Hour of the day, 0..24, in local solar time. A lobby (not started) shows the opening hour. */
export function clockHour(room:Pick<Room,'started'>,now:number){return(DAY_START+(room.started?Math.max(0,now-room.started):0)/DAY_MS*24)%24;}
/** Unit direction to the sun at a solar hour: east, north and up components (the map has east +x, north -y). */
export function sunAt(hour:number){
 const r=Math.PI/180,h=(hour-12)*15*r,lat=LATITUDE*r,dec=DECLINATION*r;
 return{east:-Math.cos(dec)*Math.sin(h),north:Math.cos(lat)*Math.sin(dec)-Math.sin(lat)*Math.cos(dec)*Math.cos(h),up:Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(h)};
}
const smoothstep=(a:number,b:number,v:number)=>{const k=Math.max(0,Math.min(1,(v-a)/(b-a)));return k*k*(3-2*k);};
/** The round's moon, 0 = new, .5 = full: fixed for a round, new each round. The moon trails the sun by its phase
 *  times a day (a full moon rises at sunset; a few nights later it rises late, so the evening is dark). */
export function moonPhase(room:Pick<Room,'seed'|'round'>){return rng(room.seed*53+(room.round||0)*4513)();}
export type Light={hour:number;sun:ReturnType<typeof sunAt>;moon:ReturnType<typeof sunAt>;phase:number;
 /** 0 at night .. 1 in daylight: civil twilight (sun 6° below to 6° above the horizon) is the change-over */
 day:number;
 /** moonlight on the ground, 0..1: how full the moon is and whether it is up */
 moonlight:number};
let memoAt=NaN,memoStarted=NaN,memoSeed=NaN,memoRound=NaN,lightMemo:Light|undefined;
export function lightAt(room:Pick<Room,'started'|'seed'|'round'>,now:number):Light{
 if(lightMemo&&now===memoAt&&room.started===memoStarted&&room.seed===memoSeed&&room.round===memoRound)return lightMemo;
 const hour=clockHour(room,now),sun=sunAt(hour),phase=moonPhase(room),moon=sunAt((hour-phase*24+24)%24);
 const full=(1-Math.cos(phase*Math.PI*2))/2;
 memoAt=now;memoStarted=room.started;memoSeed=room.seed;memoRound=room.round;return lightMemo={hour,sun,moon,phase,day:smoothstep(-.105,.105,sun.up),moonlight:full*smoothstep(-.02,.2,moon.up)};
}
export const isPredator=(s:Species)=>ANIMALS[s].prey.length>0;
/** How much of its daylight sight range an animal keeps in the dark (game values, real ordering): lions, leopards and
 *  hyenas have eyes built for low light and do most of their hunting at night; the grazers see far less on a dark
 *  night and a little more under a bright moon (lions catch more on dark, moonless nights). */
export const NIGHT_SIGHT={predator:.85,prey:.4,preyMoon:.3};
export function sightInLight(s:Species,l:Light){
 const night=isPredator(s)?NIGHT_SIGHT.predator+.1*l.moonlight:NIGHT_SIGHT.prey+NIGHT_SIGHT.preyMoon*l.moonlight;
 return l.day+(1-l.day)*night;
}
/** World events: on some savanna days (EVENT_CHANCE of them), at about 14:25 (EVENT_AT into the day, the hot dry
 *  afternoon), the plains throw up one big happening: a grass fire lit by a dry-season lightning strike (the rarer, FIRE_SHARE
 *  of events) or a column of migrating zebra crossing to the north. Whether, which, where and which way come from the
 *  room's seed, round, start time and day, so the server and every player's device work out the same event from the clock
 *  alone and nothing extra is sent; most games have none. Facts and game compressions: docs/wildlife-sources.md, "World events". */
export const EVENT_AT=55000,EVENT_WARN=10000,EVENT_CHANCE=.4,FIRE_SHARE=.35;
/** A windy late-dry-season grass fire, in m/s: the head runs downwind, the flanks creep sideways, the back burns slowly
 *  into the wind. Flames burn out after FIRE.run (evening damp); a point's flames last FIRE.flame, and green shoots show
 *  through FIRE.flush after the front passed (real regrowth takes one to three weeks: a game compression). */
export const FIRE={head:2,flank:.6,back:.2,run:90000,flame:8000,flush:40000};
/** Burns build up like storm damage: FIRE_BURN seconds' worth in the flames overcomes an animal, the heat just ahead of the
 *  front (ground it reaches within FIRE_HEAT ms) burns at FIRE_HEAT_RATE of that, and burns ease off at FIRE_HEAL per second
 *  once clear. Smoke in the lungs: for SMOKE_MS after leaving the flames, burns keep building at SMOKE_RATE before they
 *  ease. A quick dash through a thin front hurts but survives; lingering in it kills. */
export const FIRE_BURN=4,FIRE_HEAT=1500,FIRE_HEAT_RATE=.3,FIRE_HEAL=.25,SMOKE_MS=4000,SMOKE_RATE=.15;
/** The migration: MIGRANTS zebra file in from the south edge TREK_GAP ms apart and walk north at TREK_PACE (about 2.2 m/s,
 *  between a walk and a trot). A zebra player who keeps within TREK_NEAR of them for TREK_SECONDS is paid TREK_POINTS. */
export const MIGRANTS=16,TREK_GAP=1500,TREK_PACE=.32,TREK_NEAR=250,TREK_SECONDS=15,TREK_POINTS=15;
export type WorldEvent={kind:'fire'|'migration';day:number;at:number;until:number;
 /** fire: where lightning struck and the way the head runs (the round's breeze); migration: unused */
 x:number;y:number;ux:number;uy:number;
 /** migration: the column's centre line, from x0 at the south edge to x1 at the north edge */
 x0:number;x1:number};
let eventMemo:{key:string;ev:WorldEvent|null}|undefined;
/** The day's event (from the start of that day, so a device can warn before it begins), or null on a quiet day or outside a round. */
export function worldEvent(room:Pick<Room,'started'|'seed'|'round'>,now:number):WorldEvent|null{
 if(!room.started)return null;
 const day=Math.floor(Math.max(0,now-room.started)/DAY_MS),key=room.seed+':'+room.round+':'+room.started+':'+day;
 if(eventMemo?.key===key)return eventMemo.ev;
 // the start time (shared by everyone in the room) makes each game's draw its own, even in a new room's first round
 const r=rng(room.seed*13+(room.round||0)*131+day*977+Math.floor(room.started/1000)%1000003*7),happens=r()<EVENT_CHANCE,fire=r()<FIRE_SHARE;
 if(!happens){eventMemo={key,ev:null};return null;}
 const at=room.started+day*DAY_MS+EVENT_AT,w=wind(room),ps=props(417);
 let ev:WorldEvent;
 if(fire){
  // lightning strikes upwind of the middle of the plains, so the head sweeps across it with the breeze
  let x=W/2,y=H/2;
  for(let k=0;k<20;k++){x=Math.max(300,Math.min(W-300,W/2-w.x*1100+(-w.y)*(r()-.5)*1400));y=Math.max(300,Math.min(H-300,H/2-w.y*1100+w.x*(r()-.5)*1400));if(!nearWater(ps,x,y,60))break;}
  ev={kind:'fire',day,at,until:at+FIRE.run,x,y,ux:w.x,uy:w.y,x0:0,x1:0};
 }else{
  // the herds of late June move north through the central Serengeti: a column from the south edge to the north edge
  // the column takes a line clear of the kopjes (it would jam against the boulders), trying a few before settling
  let x0=W/2,x1=W/2;const rocks=ofKind(ps,'rock');
  for(let k=0;k<40;k++){x0=900+r()*(W-1800);x1=Math.max(700,Math.min(W-700,x0+(r()-.5)*1400));const a=x0,b=x1;if(rocks.every(t=>{const f=1-t.y/H;return Math.abs(t.x-(a+(b-a)*f))>solidRadius(t)+170;}))break;}
  ev={kind:'migration',day,at,until:at+(MIGRANTS-1)*TREK_GAP+Math.round(H/(TREK_PACE*ANIMALS.zebra.gait.run*UNITS_PER_METRE)*1000),x:0,y:0,ux:0,uy:-1,x0,x1};
 }
 eventMemo={key,ev};return ev;
}
const FIRE_A=(FIRE.head+FIRE.back)/2*10,FIRE_C=(FIRE.head-FIRE.back)/2*10,FIRE_F=FIRE.flank*10;
/** the edge's growth in units a second: semi-major axis, downwind drift of its centre, semi-minor axis */
export const FIRE_SHAPE={a:FIRE_A,c:FIRE_C,f:FIRE_F};
/** The fire's edge s seconds after the strike: the burnt patch of a wind-driven grass fire from a point is close to an
 *  ellipse stretched downwind that grows steadily (Anderson 1983), centre FIRE_C*s downwind, semi-axes FIRE_A*s and FIRE_F*s. */
export function fireEdge(ev:WorldEvent,s:number){return{cx:ev.x+ev.ux*FIRE_C*s,cy:ev.y+ev.uy*FIRE_C*s,a:FIRE_A*s,b:FIRE_F*s};}
/** When the front reaches a point (ms), or Infinity if the fire is out first: the smallest s with the point inside the
 *  edge, from ((along - C s)/A)^2 + (side/F)^2 = s^2. Water never burns. */
export function fireArrival(ev:WorldEvent,x:number,y:number){
 const dx=x-ev.x,dy=y-ev.y,l=dx*ev.ux+dy*ev.uy,sd=-dx*ev.uy+dy*ev.ux,A2=FIRE_A*FIRE_A,al=1-FIRE_C*FIRE_C/A2,be=2*l*FIRE_C/A2,ga=l*l/A2+sd*sd/(FIRE_F*FIRE_F);
 const t=ev.at+(-be+Math.sqrt(be*be+4*al*ga))/(2*al)*1000;
 return t>ev.until||nearWater(props(417),x,y)?Infinity:t;
}
export type Burn=''|'flames'|'burnt'|'flush';
/** The ground at a point today: unburnt (''), in the flames, burnt black, or showing the green flush after the fire. */
export function burnAt(room:Pick<Room,'started'|'seed'|'round'>,x:number,y:number,now:number):Burn{
 const ev=worldEvent(room,now);if(!ev||ev.kind!=='fire'||now<ev.at)return'';
 const t=fireArrival(ev,x,y);if(t>now)return'';
 return now<t+FIRE.flame&&now<ev.until?'flames':now>=t+FIRE.flush?'flush':'burnt';
}
/** Burnt ground has no grass: no cover in the tall grass or round a thicket, and no grass to graze until the flush. */
export const bare=(room:Pick<Room,'started'|'seed'|'round'>,x:number,y:number,now:number)=>burnAt(room,x,y,now)!=='';
export const grassGone=(room:Pick<Room,'started'|'seed'|'round'>,f:Pick<Food,'kind'|'x'|'y'>,now:number)=>{if(f.kind!=='grass')return false;const b=burnAt(room,f.x,f.y,now);return b==='flames'||b==='burnt';};
/** The front will be on this spot within `ahead` ms (or is on it now): spawning and settling avoid it. */
export function fireNear(room:Pick<Room,'started'|'seed'|'round'>,q:{x:number;y:number},now:number,ahead=15000){
 const ev=worldEvent(room,now);if(!ev||ev.kind!=='fire'||now>=ev.until||now<ev.at-EVENT_WARN)return false;
 const t=fireArrival(ev,q.x,q.y);return t<now+ahead&&t>now-FIRE.flame;
}
/** Where a wild animal runs from a fire coming at it: crosswind out of the head's path (the flanks only creep), upwind
 *  from the slow back, onto the burnt ground if it is already in the flames; nothing once it stands on the black. */
export function fireEscape(room:Room,p:Player,now:number):{x:number;y:number}|null{
 const ev=worldEvent(room,now);if(!ev||ev.kind!=='fire'||now<ev.at||now>=ev.until)return null;
 const t=fireArrival(ev,p.x,p.y);if(t<now-FIRE.flame||t>now+10000)return null;
 const e=fireEdge(ev,(now-ev.at)/1000),dx=p.x-e.cx,dy=p.y-e.cy,l=dx*ev.ux+dy*ev.uy,sd=-dx*ev.uy+dy*ev.ux,side=Math.abs(sd)>20?Math.sign(sd):idHash(p.id)>.5?1:-1;
 if(t<=now)return{x:e.cx,y:e.cy};
 const ax=l>0?0:-1,ay=l>0?side:side*.5,n=Math.hypot(ax,ay);
 return{x:p.x+(ev.ux*ax-ev.uy*ay)/n*300,y:p.y+(ev.uy*ax+ev.ux*ay)/n*300};
}
/** Heat: burns build in the flames (and more slowly in the heat ahead of them) until the animal is overcome; up a tree,
 *  down a burrow or newly spawned it is safe. */
function stepFire(p:Player,room:Room,t:number,dt:number){
 if(p.scorch===undefined&&!worldEvent(room,t))return false;
 const safe=p.climb==='limb'||p.perched||p.species==='warthog'&&p.abilityUntil>t||p.protectedUntil>t,at=burnAt(room,p.x,p.y,t);
 const ev=!safe&&at===''?worldEvent(room,t):null,a=ev?.kind==='fire'?fireArrival(ev,p.x,p.y):Infinity;
 const flames=!safe&&at==='flames',rate=safe?0:flames?1:a>t&&a<=t+FIRE_HEAT?FIRE_HEAT_RATE:(p.smokeUntil??0)>t?SMOKE_RATE:0;
 if(flames)p.smokeUntil=t+SMOKE_MS;else if(safe&&p.smokeUntil)p.smokeUntil=0;
 if(rate){
  if(!p.scorch&&!p.bot)notify(p,rate===1?'Flames! Dash through onto the burnt ground, or run crosswind.':'The heat is burning you. Get away from the fire front.',t);
  p.scorch=(p.scorch??0)+dt*rate;if(p.scorch>=FIRE_BURN){p.scorch=0;die(p,room,t,'was caught by the grass fire.');return true;}
 }else if(p.scorch)p.scorch=Math.max(0,p.scorch-dt*FIRE_HEAL);
 return false;
}
/** The migration: send the next zebra in from the south edge as its turn comes. */
function stepMigration(room:Room,t:number){
 const ev=worldEvent(room,t);if(!ev||ev.kind!=='migration'||t<ev.at)return;
 const due=Math.min(MIGRANTS,Math.floor((t-ev.at)/TREK_GAP)+1);if(room.trek?.day!==ev.day)room.trek={day:ev.day,n:0};
 if(t>ev.until)return;
 while(room.trek.n<due){
  const i=room.trek.n++,id='trek-'+room.round+'-'+ev.day+'-'+i,off=(idHash(id)-.5)*260,p=newPlayer(id,ANIMALS.zebra.name,t,true,'zebra');
  Object.assign(p,{x:Math.max(40,Math.min(W-40,ev.x0+off)),y:H-40,lane:[ev.x0+off,ev.x1+off] as [number,number],herd:'trek-'+ev.day,heading:-Math.PI/2,mood:'wander' as Mood,protectedUntil:t+2000,nextDrink:t+1e9});
  p.homeX=p.stuckX=p.x;p.homeY=p.stuckY=p.y;room.players.push(p);
 }
}
/** A zebra player keeping close to the migrating column: safety in numbers, paid once per migration. */
function stepTrek(p:Player,room:Room,t:number,dt:number){
 if(p.bot||p.species!=='zebra'||!room.trek)return;const ev=worldEvent(room,t);if(!ev||ev.kind!=='migration'||t<ev.at)return;
 const key='trek:'+ev.day;if(p.done?.includes(key))return;
 if(!room.players.some(q=>q.lane&&!q.deadUntil&&dist(p,q)<TREK_NEAR))return;
 p.trekked=(p.trekked??0)+dt;if(p.trekked>=TREK_SECONDS){(p.done??=[]).push(key);p.trekked=0;p.score+=TREK_POINTS;notify(p,'Ran with the migration +'+TREK_POINTS,t);}
}
export function cameraInput(dx:number,dy:number,yaw=0){return{dx:dx*Math.cos(yaw)+dy*Math.sin(yaw),dy:-dx*Math.sin(yaw)+dy*Math.cos(yaw)};}
export const dist=(a:{x:number;y:number},b:{x:number;y:number})=>{const dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);};
export function rng(seed:number){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// Savanna layout, generated once from a fixed seed so server, offline build and renderer agree:
// four watering holes, rocky kopjes (each boulder is a collider), scattered umbrella-thorn acacias,
// thickets of tall grass and scrub to hide in, and old aardvark burrows that warthogs use.
let LAYOUT:Prop[]|null=null;
function layout():Prop[]{
 if(LAYOUT)return LAYOUT;const r=rng(417),out:Prop[]=[];
 const clear=(x:number,y:number,gap:number,kinds:Prop['kind'][])=>out.every(p=>!kinds.includes(p.kind)||dist(p,{x,y})>gap+(p.kind==='water'?p.size:0));
 for(const [x,y,s] of [[1180,860,170],[2900,700,140],[2350,1900,200],[700,2050,130]] as const)out.push({x,y,kind:'water',size:s});
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
 // tall-grass patches grow along drainage near water and in a few open swales. They use their own seed so the
 // older layout above keeps every acacia, boulder and burrow where it was.
 const g=rng(911),waters=out.filter(p=>p.kind==='water');
 for(let n=0;out.filter(p=>p.kind==='tallgrass').length<24&&n<4000;n++){
  let x=200+g()*(W-400),y=200+g()*(H-400);const size=.8+g()*.7;
  if(g()<.6){const w=waters[Math.floor(g()*waters.length)],a=g()*Math.PI*2,d=w.size*1.5+size*100+g()*380;x=w.x+Math.cos(a)*d;y=w.y+Math.sin(a)*d;}
  if(x<160||y<160||x>W-160||y>H-160)continue;
  if(clear(x,y,size*100+15,['water'])&&clear(x,y,size*100+25,['rock'])&&clear(x,y,size*100+70,['tallgrass'])&&clear(x,y,size*100,['burrow']))out.push({x,y,kind:'tallgrass',size});
 }
 return LAYOUT=out;
}
/** radius of a tall-grass patch in game units */
export const GRASS_PATCH=100;
/** True inside a patch of tall grass (about 1.2 m high: it hides animals shorter than a metre at the shoulder). */
export const inTallGrass=(ps:Prop[],x:number,y:number)=>ofKind(ps,'tallgrass').some(t=>Math.hypot(x-t.x,y-t.y)<t.size*GRASS_PATCH);
let TRAILS:[number,number,number,number][]|null=null;
/** Game trails: worn paths from each watering hole to its two nearest kopjes and to the nearest other watering hole. */
export function trails(){
 if(TRAILS)return TRAILS;const ps=layout(),waters=ps.filter(p=>p.kind==='water'),kopjes=ps.filter(p=>p.kind==='rock'&&p.size>=1.3),out:[number,number,number,number][]=[];
 const add=(a:{x:number;y:number},b:{x:number;y:number})=>{if(!out.some(s=>s[0]===b.x&&s[1]===b.y&&s[2]===a.x&&s[3]===a.y))out.push([a.x,a.y,b.x,b.y]);};
 for(const w of waters){for(const k of [...kopjes].sort((a,b)=>dist(a,w)-dist(b,w)).slice(0,2))add(w,k);add(w,waters.filter(o=>o!==w).sort((a,b)=>dist(a,w)-dist(b,w))[0]);}
 return TRAILS=out;
}
/** distance from (x, y) to the nearest game trail */
export function trailDistance(x:number,y:number){let best=Infinity;for(const [ax,ay,bx,by] of trails()){const vx=bx-ax,vy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*vx+(y-ay)*vy)/(vx*vx+vy*vy)));best=Math.min(best,Math.hypot(x-ax-vx*t,y-ay-vy*t));}return best;}
export function props(seed:number):Prop[]{return layout();}
const kindCache=new WeakMap<Prop[],Partial<Record<Prop['kind'],Prop[]>>>();
/** The props of one kind, in table order (cached per table: the hot per-step checks only look at the few they need). */
export function ofKind(ps:Prop[],kind:Prop['kind']):Prop[]{let k=kindCache.get(ps);if(!k)kindCache.set(ps,k={});return k[kind]??=ps.filter(t=>t.kind===kind);}
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
export const nearWater=(ps:Prop[],x:number,y:number,margin=0)=>ofKind(ps,'water').some(t=>Math.hypot(t.x-x,t.y-y)<t.size+margin);
const blocked=(ps:Prop[],x:number,y:number,gap:number)=>ps.some(t=>solid(t)&&dist(t,{x,y})<solidRadius(t)+gap)||nearWater(ps,x,y,gap*.5);
// Food: fresh grass on open ground, acacia browse under trees, roots and bulbs, and old carcasses.
export function makeFoods(seed:number):Food[]{const r=rng(seed+111),ps=props(seed),trees=ps.filter(t=>t.kind==='tree');return Array.from({length:560},(_,id)=>{const kind=(['grass','grass','browse','roots','grass','carrion','roots','browse','grass','grass'] as const)[id%10];let x=0,y=0;for(let n=0;n<35;n++){if(kind==='browse'){const t=trees[Math.floor(r()*trees.length)],a=r()*Math.PI*2,d=25+r()*35;x=t.x+Math.cos(a)*d;y=t.y+Math.sin(a)*d;}else{x=65+r()*(W-130);y=65+r()*(H-130);}if(!blocked(ps,x,y,30))break;}return{id,x,y,kind,ready:0};});}
export function safePoint(seed:number):{x:number;y:number}{const r=rng(seed),ps=props(417);for(let i=0;i<30;i++){const q={x:100+r()*(W-200),y:100+r()*(H-200)};if(!blocked(ps,q.x,q.y,40))return q;}return{x:W/2,y:H/2};}
// Spawning follows where each animal really lives: zebra and impala herds graze the open grass around water (impala
// also along acacia edges), warthogs keep near their burrows, lions lie up by thickets and in acacia shade, leopards
// stay by trees and kopjes, and hyena clans den among the rocks. Herd animals join a living group of their own kind,
// and nobody spawns in a predator's sight.
const GROUPS:Partial<Record<Species,number>>={zebra:8,impala:10,warthog:4,hyena:4,lion:4};
function habitat(species:Species,r:()=>number){
 const ps=props(417),pick=(kind:Prop['kind'],test:(p:Prop)=>boolean=()=>true)=>{const list=ps.filter(p=>p.kind===kind&&test(p));return list[Math.floor(r()*list.length)];};
 const around=(c:{x:number;y:number},min:number,max:number)=>{const a=r()*Math.PI*2,d=min+r()*(max-min);return{x:c.x+Math.cos(a)*d,y:c.y+Math.sin(a)*d};};
 for(let i=0;i<40;i++){
  let q:{x:number;y:number};
  if(species==='zebra'||species==='impala'&&r()<.65){const w=pick('water');q=around(w,w.size+60,w.size+(species==='zebra'?520:380));}
  else if(species==='impala')q=around(pick('tree'),50,160);
  else if(species==='warthog')q=around(pick('burrow'),25,110);
  else if(species==='lion')q=r()<.55?around(pick('bush'),20,60):around(pick('tree'),25,55);
  else if(species==='leopard')q=r()<.6?around(pick('tree'),15,40):around(pick('rock',p=>p.size>=1.3),70,150);
  else q=around(pick('rock',p=>p.size>=1.3),90,220);
  if(q.x>60&&q.y>60&&q.x<W-60&&q.y<H-60&&!blocked(ps,q.x,q.y,30))return q;
 }
 return safePoint(Math.floor(r()*1e9));
}
const inSight=(room:Room|undefined,species:Species,q:{x:number;y:number})=>!!room&&room.players.some(o=>!o.deadUntil&&(ANIMALS[o.species].prey.includes(species)||!o.bot&&ANIMALS[species].prey.includes(o.species))&&dist(o,q)<THREAT_RANGE*.85);
export function spawnPoint(species:Species,room?:Room,seed=Math.floor(Math.random()*1e9)):{x:number;y:number}{
 const r=rng(seed),ps=props(417),cap=GROUPS[species];
 if(room&&cap){
  const mates=room.players.filter(o=>o.species===species&&!o.deadUntil&&room.players.filter(m=>m.species===species&&!m.deadUntil&&dist(m,o)<150).length<cap);
  for(let i=0;i<8&&mates.length;i++){const m=mates[Math.floor(r()*mates.length)],a=r()*Math.PI*2,d=22+r()*55,q={x:m.x+Math.cos(a)*d,y:m.y+Math.sin(a)*d};if(q.x>60&&q.y>60&&q.x<W-60&&q.y<H-60&&!blocked(ps,q.x,q.y,25)&&!inSight(room,species,q))return q;}
 }
 let q=habitat(species,r);for(let i=0;i<14&&(inSight(room,species,q)||!!room&&fireNear(room,q,room.tick,20000));i++)q=habitat(species,r);
 return q;
}
/** Spawn protection (a game rule, not a wildlife fact): a player's new animal can't be caught, kicked or burnt for this long,
 *  so nobody is taken the instant they appear. Set anywhere from 5 to 8 s. It ends early the moment the protected player
 *  lunges or kicks (dropShield). Computer-controlled wildlife keeps the shorter WILD_PROTECT_MS. */
export const SPAWN_PROTECT_MS=6000,WILD_PROTECT_MS=4000;
/** The protected player attacked: its own protection ends now. */
export function dropShield(p:Player,now:number){if(p.protectedUntil>now)p.protectedUntil=now-1;}
export function newPlayer(id:string,name:string,now:number,bot=false,species?:Species,room?:Room):Player{const kind=species||SPECIES[Math.floor(Math.random()*6)];const p={id,name,bot,species:kind,...spawnPoint(kind,room,Math.floor(Math.random()*1e9)),dx:0,dy:0,vx:0,vy:0,perched:false,perchHeight:0,actionUntil:0,lastSeen:now,inputAt:now,born:now,protectedUntil:now+(bot?WILD_PROTECT_MS:SPAWN_PROTECT_MS),deadUntil:0,abilityUntil:0,abilityReady:0,interactReady:0,stunUntil:0,hunger:100,feeding:undefined,survived:0,thirst:70+idHash(id+'water')*25,strikeId:'',strikeAt:0,strikeAmbush:false,score:0,deaths:0,food:0,hunts:0,drinks:0,scavenged:0,escapes:0,hiddenSeconds:0,survivalSeconds:0,claimed:[false,false,false],sprint:false,stamina:100,threatAt:0,face:1,message:'A new place in the chain.',messageUntil:now+3000,seq:0,targetX:0,targetY:0,heading:0,mood:'wander' as Mood,alert:0,targetId:'',moodUntil:0,alarmAt:0,calledAt:0,threatX:0,threatY:0,lastThreatAt:0,homeX:0,homeY:0,herd:'',nextDrink:now+40000+idHash(id)*60000,chaseStart:0,thinkAt:0,stuckX:0,stuckY:0,stuckAt:now,unstickUntil:0};p.homeX=p.stuckX=p.x;p.homeY=p.stuckY=p.y;return p;}
/** A stable 0..1 number per animal, for per-animal variety (reaction time, flee angle) that tests can reproduce. */
export function idHash(id:string){let h=2166136261;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);return((h^h>>>15)>>>0)/4294967296;}
/** Seeded randomness kept in the room, so a round's wildlife decisions replay the same from the same state. */
export function roll(room:Room){const r=rng(room.rs??=room.seed*977+room.round*131)();room.rs=(room.rs+0x9E3779B9)|0;return r;}
export function newRoom(code:string,host:Player,now:number):Room{return{code,host:host.id,phase:'lobby',started:0,ends:0,tick:now,players:[host],foods:makeFoods(417),events:['Welcome to the Golden Plains.'],seed:417,round:0};}
export function notify(p:Player,message:string,now:number){p.message=message;p.messageUntil=now+2500;}
/** A badge for a real behaviour (lib/rewards.ts), once a round; the player's device keeps the tally. */
export function award(p:Player,id:BadgeId){if(p.bot)return;const b=p.badges??=[];if(!b.includes(id))b.push(id);}
/** A human's next animal, dealt from a shuffled bag of all six: each species comes up once every six lives (a fresh bag
 *  never starts with the animal just played), instead of independent draws that can leave one out for a long time. */
export function nextSpecies(p:Pick<Player,'species'|'bag'>):Species{
 if(!p.bag?.length){const bag=[...SPECIES].map(s=>[Math.random(),s] as const).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);if(bag[0]===p.species)bag.push(bag.shift()!);p.bag=bag;}
 return p.bag.shift()!;
}
export function respawn(p:Player,now:number,room?:Room){const species=p.bot?(WILDLIFE[Number(p.id.replace('wild-',''))]||p.species):nextSpecies(p);const fresh=newPlayer(p.id,p.bot?ANIMALS[species].name:p.name,now,p.bot,species,room);const carry=p.carry;Object.assign(p,fresh,{bag:p.bag,lives:p.lives,lifeStart:p.score,carry:undefined,score:p.score,deaths:p.deaths,token:p.token,lastSeen:p.lastSeen,seq:p.seq,herd:p.herd,homeX:p.homeX,homeY:p.homeY});if(carry){p.hunger=Math.min(p.hunger,Math.max(25,carry.hunger));p.thirst=Math.min(p.thirst??100,Math.max(25,carry.thirst));}if(p.bot&&room)rejoinHerd(p,room,now);p.claimed=p.claimed.map((_,i)=>i<2&&!!p.done?.includes(p.species+':'+i));notify(p,'New life. New animal.',now);}
export function start(room:Room,now:number){room.phase='playing';room.started=now;room.endedBy=undefined;room.ends=room.duration===0?0:now+(room.duration??300)*1000;room.tick=now;room.round++;room.foods=makeFoods(room.seed);room.players=room.players.filter(p=>!p.bot);for(const p of room.players){const token=p.token,species=nextSpecies(p),bag=p.bag;Object.assign(p,newPlayer(p.id,p.name,now,false,species,room),{token,bag,done:[],lives:[],lifeStart:0,badges:[]});}room.rs=room.seed*977+room.round*131;placeWildlife(room,now);room.events=['Golden graze. Find food, complete tasks, survive.'];}
export const leaping=(p:Player,now:number)=>p.species==='impala'&&p.abilityUntil>now;
const stalking=(p:Player,now:number)=>p.species==='leopard'&&p.abilityUntil>now&&!p.perched;
const inThicket=(ps:Prop[],x:number,y:number)=>bushNear(ps,x,y,26);
// Hidden (cannot be caught or seen): a leopard up an acacia, a warthog in its burrow, or anyone but a zebra standing still
// inside a thicket. The thicket reach matches the ring of tall grass drawn around each bush, so a hidden animal is always
// Stalk is a game ability: full concealment from animal senses for its active duration.
export function hidden(p:Player,room:Room,now:number){return stalking(p,now)||p.species==='leopard'&&p.climb==='limb'||p.species==='warthog'&&p.abilityUntil>now||p.species!=='zebra'&&Math.hypot(p.dx,p.dy)<.1&&Math.hypot(p.vx||0,p.vy||0)<8&&inThicket(props(room.seed),p.x,p.y)&&!bare(room,p.x,p.y,now);}
/** The round's breeze: the direction it blows towards (scent drifts downwind). Fixed for a round, new each round. */
export function wind(room:Pick<Room,'seed'|'round'>){const a=rng(room.seed*31+(room.round||0)*7919)()*Math.PI*2;return{x:Math.cos(a),y:Math.sin(a),angle:a};}
export const speedOf=(p:{vx?:number;vy?:number})=>Math.hypot(p.vx||0,p.vy||0);
/** An animal's normal running pace in units per second; anything faster is a sprint. */
export const walkPace=(s:Species)=>ANIMALS[s].gait.run*UNITS_PER_METRE;
/** Grazing animals with their heads down notice less. Heads lift on a steady rhythm the client draws the same way. */
export const headDown=(p:Pick<Player,'mood'|'id'>,now:number)=>p.mood==='graze'&&Math.sin(now/1000*.9+idHash(p.id)*6.283)>-.35;
/** How noticeable an animal is, 0..1: running is obvious, walking less so, standing still least. Cover only counts when
 *  it is really covering the animal: tall grass hides animals under a metre at the shoulder (a lion or zebra sticks out). */
export function conspicuity(t:Player,ps:Prop[],now:number,room?:Pick<Room,'started'|'seed'|'round'>){
 const v=speedOf(t),pace=walkPace(t.species);
 let c=v<8?.35:v<pace*.65?.6:v<pace*1.05?.8:1;
 // a zebra is big and boldly striped in open grass: even standing still it is easy to pick out
 if(t.species==='zebra')c=Math.max(c,.65);
 if(stalking(t,now))c*=.45;
 {const pose=postureOf(t);if(pose)c*=POSTURE_SIGHT[pose];}
 if(t.perched)c*=.5;
 // the grass round a thicket and the tall-grass swales burn: on the black there is nowhere to hide
 else if(room&&bare(room,t.x,t.y,now))return c;
 else if(t.species!=='zebra'&&inThicket(ps,t.x,t.y))c*=.45;
 else if(ANIMALS[t.species].size<1&&inTallGrass(ps,t.x,t.y))c*=v>pace*1.05?.8:.5;
 return c;
}
/** True when a boulder stands between a and b (acacia trunks are too thin to hide behind). */
/** A trunk or boulder between two animals: no catch goes through wood or stone. */
export function contactBlocked(ps:Prop[],a:{x:number;y:number},b:{x:number;y:number}){
 const vx=b.x-a.x,vy=b.y-a.y,len=Math.hypot(vx,vy);if(len<1)return false;
 for(const t of solidNear(ps,(a.x+b.x)/2,(a.y+b.y)/2,len/2+60)){const r=solidRadius(t),u=((t.x-a.x)*vx+(t.y-a.y)*vy)/(len*len);if(u<=0||u>=1)continue;if(Math.hypot(a.x+vx*u-t.x,a.y+vy*u-t.y)<r)return true;}
 return false;
}
/** The way an animal's attack goes: where the player is steering, else the way it is moving or last faced. */
export const strikeDirection=(p:Player)=>Math.hypot(p.dx,p.dy)>.1?Math.atan2(p.dy,p.dx):p.heading??0;
/** A hunter can still end up with its prey's centre inside its own body (a leopard dropping onto it, a kick or a spawn
 *  on top of it): that is contact whichever way it faces. */
export const touching=(p:Player,q:{x:number;y:number})=>dist(p,q)<BODY[p.species][1]*UNITS_PER_METRE;
/** Prey in front of the hunter: within 85° either side of the way it attacks, or already inside its body. */
export const inFront=(p:Player,q:{x:number;y:number})=>touching(p,q)||Math.cos(Math.atan2(q.y-p.y,q.x-p.x)-strikeDirection(p))>=Math.cos(85*Math.PI/180);
export function sightBlocked(ps:Prop[],a:{x:number;y:number},b:{x:number;y:number}){
 const vx=b.x-a.x,vy=b.y-a.y,len=Math.hypot(vx,vy);if(len<1)return false;
 for(const t of solidNear(ps,(a.x+b.x)/2,(a.y+b.y)/2,len/2+60)){if(t.kind!=='rock')continue;const r=solidRadius(t)*.9,u=((t.x-a.x)*vx+(t.y-a.y)*vy)/(len*len);if(u<=0||u>=1)continue;if(Math.hypot(a.x+vx*u-t.x,a.y+vy*u-t.y)<r&&dist(t,a)>r+4&&dist(t,b)>r+4)return true;}
 return false;
}
export type Cue={how:'close'|'sight'|'scent'|'sound';range:number};
export const CLOSE_RANGE=45,SCENT_RANGE=170,SOUND_RANGE=190;
/** How (if at all) observer o notices t. The same rule drives wildlife, the player's Tracking labels and danger cues:
 *  - close: within 4.5 m anything not hidden is noticed;
 *  - sight: within the observer's sight range scaled by how conspicuous t is, unless a boulder blocks the line;
 *  - scent: within 17 m when the breeze blows from t towards o (game rule: approach from downwind);
 *  - sound: within 19 m when t is sprinting (no exact position, just a direction). */
/** Sneaking up from behind (a game rule): a player's predator that is not sprinting, outside the 220° arc a
 *  computer-controlled prey animal faces, can't set off its close-range or scent alert. Sight, the sound of a sprint and
 *  herd alarm calls still work as usual. Only for a hunter that could actually take this prey. */
export const FORWARD_ARC=220;
export function creptBehind(o:Player,t:Player,room:Room,now:number){
 if(!o.bot||t.bot||!canTake(t,o,room)||sprinting(t,now))return false;
 return Math.cos(Math.atan2(t.y-o.y,t.x-o.x)-(o.heading??0))<Math.cos(FORWARD_ARC/2*Math.PI/180);
}
export function sense(o:Player,t:Player,room:Room,now:number,ps=props(room.seed)):Cue|null{
 if(t.deadUntil||hidden(t,room,now))return null;
 const d=dist(o,t),unnoticed=creptBehind(o,t,room,now);if(d<CLOSE_RANGE&&!unnoticed)return{how:'close',range:d};
 if(d>400)return null;
 const light=lightAt(room,now),sight=ANIMALS[o.species].sight*(headDown(o,now)?.7:1)*conspicuity(t,ps,now,room)*sightInLight(o.species,light)*(perkOf(t)==='night'?1-PERK_SIZE.night*(1-light.day):1);
 if(d<sight&&!sightBlocked(ps,o,t))return{how:'sight',range:d};
 const w=wind(room);if(d<SCENT_RANGE&&!unnoticed&&((o.x-t.x)*w.x+(o.y-t.y)*w.y)/d>.64)return{how:'scent',range:d};
 if(d<SOUND_RANGE&&speedOf(t)>walkPace(t.species)*1.05)return{how:'sound',range:d};
 return null;
}
/** Thirst falls from full to empty in about four minutes, so an animal needs one or two drinks a life; below
 *  THIRSTY it can drink (and scores for it). Real animals drink about daily; this is a game rate. */
export const THIRST_RATE=100/240,THIRSTY=60,FULL=90;
/** Food runs down per second. Grazers live on poor food and must eat most of the day; big carnivores gorge on a kill
 *  and can go days between meals, so their meter falls more slowly (game rates, real ordering). */
/** Spotted hyenas bring down zebra only as a clan (Kruuk's Serengeti hunts: several hyenas, often many more, run a
 *  zebra down together); a lone hyena can't. A hyena counts as in a clan with two more within 30 m. */
export const CLAN_SIZE=3,CLAN_RANGE=300;
export function canTake(p:Player,q:{species:Species},room:Room,range=CLAN_RANGE){
 if(!ANIMALS[p.species].prey.includes(q.species))return false;
 if(p.species==='hyena'&&q.species==='zebra')return room.players.filter(o=>o!==p&&o.species==='hyena'&&!o.deadUntil&&dist(o,p)<range).length>=CLAN_SIZE-1;
 return true;
}
/** How much a wild hunter favours each prey when choosing (it will go after a favoured animal further away): lions
 *  mostly hunt zebra and other big grazers, hyena clans run down zebra and impala. Small prey (below 1) is only worth
 *  a chase once the hunter is properly hungry. */
const PREFERENCE:Partial<Record<Species,Partial<Record<Species,number>>>>={lion:{zebra:3,impala:1,warthog:.35},hyena:{zebra:2.2,impala:1,warthog:.6}};
export const HUNGER_RATE:Record<Species,number>={lion:.35,leopard:.4,hyena:.45,zebra:.6,impala:.6,warthog:.6};
/** catch reach over each species' catchRange: 1.2 and then 1.44 in the Oct 27 playtests, then 18% more (Oct 29) */
export const HUNT_REACH_MULTIPLIER=1.44*1.18;
/** Coat perks: a few coats and skins (lib/rewards.ts) carry a small advantage, read by the server from the player's
 *  coat code, so multiplayer stays fair. Game rules, kept modest:
 *  - night: a melanistic (black) leopard is 30 % harder to see in the dark, fading in as the light goes;
 *  - bite: a dark-maned lion reaches 10 % further with a lunge (a nod to dark manes marking males in good condition,
 *    West & Packer 2002; the reach itself is invented);
 *  - speed: Emberhide, on any animal, adds 5 % to its own run and sprint speeds;
 *  - stamina: Sun-Gilded, on any animal, makes its sprint last 20 % longer. */
export type Perk='night'|'bite'|'speed'|'stamina';
export const PERK_SIZE={night:.3,bite:.1,speed:.05,stamina:.2} as const;
/** which coat (code digit) carries which perk; legendary skins (3+) are the same for every species */
export const COAT_PERKS:{species?:Species;coat:number;perk:Perk}[]=[{species:'leopard',coat:2,perk:'night'},{species:'lion',coat:1,perk:'bite'},{coat:4,perk:'speed'},{coat:3,perk:'stamina'}];
export const coatPerk=(species:Species,coat:number)=>COAT_PERKS.find(k=>k.coat===coat&&(!k.species||k.species===species))?.perk;
/** the perk of the coat this player wears in this room (bots wear the usual coat) */
export const perkOf=(p:Pick<Player,'species'|'coats'|'bot'>)=>p.bot||!p.coats?undefined:coatPerk(p.species,Number(p.coats[SPECIES.indexOf(p.species)]??0));
export const UNITS_PER_METRE=10,TRUNK_RADIUS=7,POUNCE_RANGE=42,AMBUSH_RANGE=60,KICK_RANGE=40,FOOD_RANGE=18,BURROW_REACH=45,TREE_REACH=40,WATER_REACH=30,THREAT_RANGE=300,LEAP_SPEED=11,STALK_SPEED=4.5;
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a)),clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** True while the animal is running flat out on its stamina (Charge and Tireless sprint for free). */
export const sprinting=(p:Player,now:number)=>{const g=ANIMALS[p.species].gait,free=p.abilityUntil>now&&(p.species==='lion'||p.species==='hyena');return!free&&p.sprint&&!p.exhausted&&Math.hypot(p.vx,p.vy)/UNITS_PER_METRE>g.run+.5;};
// Movement steers the velocity vector straight toward the input: the part of the change along the current motion
// is limited by accel (speeding up) or brake (slowing down), the sideways part by grip. A reversal therefore plants
// and pushes off the other way instead of looping round, and a sideways input bends the path within a few metres.
// Facing is separate (the renderer turns the body at the species' turnRate), so movement never waits on rotation.
/** `others`: animals near enough to touch (see bodyGrid); their bodies are solid to this one. */
/** Posture a player can choose, as the wildlife does (a stalking hunter crouches, an animal lies up to rest). Game rules:
 *  crouched, it moves no faster than its walk and is about 40 % harder to pick out; lying down, it doesn't move, is
 *  half as easy to see and gets its breath back 50 % faster. Sprinting or (when lying) moving stands it up. */
export type Posture='crouch'|'lie';
export const POSTURE_SIGHT={crouch:.6,lie:.5} as const,LIE_RECOVERY=1.5;
export const postureOf=(p:Pick<Player,'posture'|'perched'|'climb'|'deadUntil'>)=>p.perched||p.climb||p.deadUntil?undefined:p.posture;
export function move(p:Player,dt:number,ps:Prop[],now:number,others:readonly Player[]=[]){
 p.vx??=0;p.vy??=0;p.stamina??=100;
 if(p.climb){climbStep(p,dt,ps,now);return;}
 if(p.perched||p.species==='warthog'&&p.abilityUntil>now||(p.stunUntil??0)>now){p.vx=0;p.vy=0;return;}
 const g=ANIMALS[p.species].gait,U=UNITS_PER_METRE,active=p.abilityUntil>now,input=Math.hypot(p.dx,p.dy)>.1;
 const leap=p.species==='impala'&&active,charge=p.species==='lion'&&active,free=charge||p.species==='hyena'&&active,stalk=p.species==='leopard'&&active;
 let vx=p.vx/U,vy=p.vy/U,speed=Math.hypot(vx,vy);
 // a partly pushed stick (or a grazing herd's slow drift) moves between a walk and the normal run
 let target=!input&&!charge?0:stalk?STALK_SPEED:(p.sprint||charge)&&(free||!p.exhausted&&p.stamina>0)?g.sprint:Math.max(g.walk,g.run*Math.min(1,Math.hypot(p.dx,p.dy)));
 if(perkOf(p)==='speed'&&target>g.walk)target*=1+PERK_SIZE.speed;
 {const pose=postureOf(p);if(pose==='lie')target=0;else if(pose==='crouch'&&!charge)target=Math.min(target,g.walk);}
 // game rule: wading through a watering hole or its mud ring slows every animal a little
 if(ofKind(ps,'water').some(t=>Math.hypot(p.x-t.x,p.y-t.y)<t.size*1.25))target*=.8;
 const dir=input?Math.atan2(p.dy,p.dx):Math.atan2(vy,vx),wx=Math.cos(dir)*target,wy=Math.sin(dir)*target;
 if(leap){const k=Math.max(speed,LEAP_SPEED)/Math.max(speed,.001);if(speed>.001){vx*=k;vy*=k;}}
 else if(speed<.05){const ex=wx-vx,ey=wy-vy,e=Math.hypot(ex,ey),k=e>g.accel*dt?g.accel*dt/e:1;vx+=ex*k;vy+=ey*k;}
 else{
  const ux=vx/speed,uy=vy/speed,ex=wx-vx,ey=wy-vy,along=ex*ux+ey*uy,sx=ex-along*ux,sy=ey-along*uy,side=Math.hypot(sx,sy);
  const push=clamp(along,-g.brake*dt,g.accel*(charge?1.4:1)*dt),bend=side>g.grip*dt?g.grip*dt/side:1;
  vx+=ux*push+sx*bend;vy+=uy*push+sy*bend;
 }
 if(Math.hypot(vx,vy)<.02){vx=0;vy=0;}
 p.vx=vx*U;p.vy=vy*U;
 let x=Math.max(25,Math.min(W-25,p.x+p.vx*dt)),y=Math.max(25,Math.min(H-25,p.y+p.vy*dt));
 if(others.length&&solidBody(p,now))({x,y}=shoulder(p,x,y,others,now));
 ({x,y}=collide(p,x,y,ps));
 p.x=x;p.y=y;if(Math.abs(p.vx)>1)p.face=p.vx>0?1:-1;if(Math.hypot(p.vx,p.vy)>5)p.heading=Math.atan2(p.vy,p.vx);
}
/** Stamina: a flat-out sprint empties it in the species' sprint time; resting refills it over its recovery time. */
export function breathe(p:Player,dt:number,now:number){
 const g=ANIMALS[p.species].gait,speed=Math.hypot(p.vx,p.vy)/UNITS_PER_METRE;
 if(sprinting(p,now))p.stamina-=100/(g.sprintTime*(perkOf(p)==='stamina'?1+PERK_SIZE.stamina:1))*dt;else p.stamina+=100/g.recover*dt*(speed>g.run*.8?.4:1)*(postureOf(p)==='lie'?LIE_RECOVERY:1);
 p.stamina=clamp(p.stamina,0,100);if(p.stamina<=.5)p.exhausted=true;else if(p.stamina>=30)p.exhausted=false;
}
// ---------------------------------------------------------------- bodies, trunks and climbing
/** Body extent in metres for collisions: how far the nose reaches ahead of the body's origin, the rump behind it, and
 *  half the body's width. Measured off the models, so a lion can't push its head into a trunk or its flank into a boulder. */
export const BODY:Record<Species,[number,number,number]>={lion:[1.15,.85,.3],leopard:[.85,.62,.19],hyena:[.9,.58,.2],zebra:[1.3,.8,.33],impala:[.78,.55,.17],warthog:[.88,.55,.23]};
/** Push a body (a capsule from rump to nose along its heading) out of every trunk and boulder it overlaps, and drop the
 *  part of its velocity that drives into them. Two passes settle the corners between neighbouring boulders. */
function collide(p:Player,x:number,y:number,ps:Prop[]){
 const [front,rear,half]=BODY[p.species],U=UNITS_PER_METRE,h=Math.hypot(p.vx,p.vy)>5?Math.atan2(p.vy,p.vx):p.heading??0,hx=Math.cos(h),hy=Math.sin(h);
 for(let pass=0;pass<2;pass++)for(const t of solidNear(ps,x,y,126+front*U)){
  const r=solidRadius(t)+half*U,u=clamp((t.x-x)*hx+(t.y-y)*hy,-rear*U,front*U),cx=x+hx*u,cy=y+hy*u,d=Math.hypot(cx-t.x,cy-t.y);
  if(d>=r)continue;const nx=d>.001?(cx-t.x)/d:-hx,ny=d>.001?(cy-t.y)/d:-hy;x+=nx*(r-d);y+=ny*(r-d);
  const inward=p.vx*nx+p.vy*ny;if(inward<0){p.vx-=inward*nx;p.vy-=inward*ny;}
 }
 return{x:Math.max(25,Math.min(W-25,x)),y:Math.max(25,Math.min(H-25,y))};
}
/** Does this animal have a body others bump into? Not while dead, up a tree, down a burrow or in the air mid-leap (an
 *  impala clears other animals in its bound). */
export const solidBody=(p:Player,now:number)=>!p.deadUntil&&(!p.climb||p.climb==='approach')&&!p.perched&&!(p.species==='warthog'&&p.abilityUntil>now)&&!leaping(p,now);
const bodyHeading=(p:Player)=>Math.hypot(p.vx||0,p.vy||0)>5?Math.atan2(p.vy,p.vx):p.heading??0;
/** Closest points of two segments a+u·s (s in a0..a1) and b+v·t (t in b0..b1), u and v unit vectors: the gap from b's to a's. */
function segmentGap(ax:number,ay:number,ux:number,uy:number,a0:number,a1:number,bx:number,by:number,vx:number,vy:number,b0:number,b1:number){
 const rx=ax-bx,ry=ay-by,b=ux*vx+uy*vy,c=ux*rx+uy*ry,f=vx*rx+vy*ry,den=1-b*b;
 // parallel: B's extent seen along A; take the middle of where they overlap (or A's end nearest to B)
 const lo=Math.min(b*b0,b*b1)-c,hi=Math.max(b*b0,b*b1)-c;
 let sa=den>1e-6?clamp((b*f-c)/den,a0,a1):clamp((Math.max(lo,a0)+Math.min(hi,a1))/2,a0,a1);const tb=clamp(b*sa+f,b0,b1);sa=clamp(b*tb-c,a0,a1);
 return{dx:ax+ux*sa-bx-vx*tb,dy:ay+uy*sa-by-vy*tb};
}
/** Animals are solid to each other: push a body (its rump-to-nose capsule) out of every other animal's it overlaps and
 *  drop the part of its velocity that drives into them, so it slides along a flank instead of passing through. Each
 *  animal only moves itself, so a lion can't shove a standing zebra aside; it has to go round. */
function shoulder(p:Player,x:number,y:number,others:readonly Player[],now:number){
 const U=UNITS_PER_METRE,[front,rear,half]=BODY[p.species],h=bodyHeading(p),hx=Math.cos(h),hy=Math.sin(h);
 for(const q of others){
  if(q===p||Math.abs(q.x-x)>40||Math.abs(q.y-y)>40||!solidBody(q,now))continue;
  const [qf,qr,qh]=BODY[q.species],g=bodyHeading(q),r=(half+qh)*U;
  const {dx,dy}=segmentGap(x,y,hx,hy,-rear*U,front*U,q.x,q.y,Math.cos(g),Math.sin(g),-qr*U,qf*U),d=Math.hypot(dx,dy);
  if(d>=r)continue;
  let nx:number,ny:number,depth:number;
  if(d>.001){nx=dx/d;ny=dy/d;depth=r-d;}
  else{
   // the two spines cross or lie end to end (nose into rump on one line): part along the line between their centres,
   // as far as their extents along it overlap; right on top of each other, step out sideways
   const cx=x-q.x,cy=y-q.y,c=Math.hypot(cx,cy);if(c>.001){nx=cx/c;ny=cy/c;}else{nx=-hy;ny=hx;}
   const k=hx*nx+hy*ny,k2=Math.cos(g)*nx+Math.sin(g)*ny;
   depth=(Math.max(k*rear,-k*front)+half+Math.max(-k2*qr,k2*qf)+qh)*U-c;if(depth<=0)continue;
  }
  x+=nx*depth;y+=ny*depth;
  const inward=p.vx*nx+p.vy*ny;if(inward<0){p.vx-=inward*nx;p.vy-=inward*ny;}
 }
 return{x,y};
}
const BODY_CELL=80;
/** Animals bucketed by 8 m cell, so each body only checks its neighbours (68 animals: a handful each instead of all). */
export function bodyGrid(players:readonly Player[]){
 const grid=new Map<number,Player[]>();
 for(const p of players){if(p.deadUntil)continue;const k=Math.floor(p.x/BODY_CELL)*1024+Math.floor(p.y/BODY_CELL),cell=grid.get(k);if(cell)cell.push(p);else grid.set(k,[p]);}
 return grid;
}
export function bodiesNear(grid:Map<number,Player[]>,x:number,y:number){
 const cx=Math.floor(x/BODY_CELL),cy=Math.floor(y/BODY_CELL),out:Player[]=[];
 for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const cell=grid.get((cx+i)*1024+cy+j);if(cell)out.push(...cell);}
 return out;
}
export type Climb=''|'approach'|'trunk'|'mount'|'limb'|'drop'|'slip';
/** Who climbs, and how (metres, m/s). Leopards are true climbers: up a trunk at about 2 m/s (forelimbs pulling, hind
 *  limbs pushing), out along boughs down to ~4.5 cm radius, and down head first with a jump for the last 1.6 m. Lions are
 *  clumsy, occasional climbers: only into a thick, low bough (no higher than 1.8 m), never out onto thin wood, and
 *  they jump down rather than climb down. Hyenas, zebras, impalas and warthogs can't climb at all. paws: how far the
 *  fore and hind paws sit ahead of / behind the body's origin. rest: how far out a resting animal settles. lean: how
 *  upright the body gets on the trunk (1 = vertical): a leopard hangs on the bark, a lion braces at an angle, hind feet low. */
export const CLIMB:Partial<Record<Species,{up:number;down:number;branch:number;minRadius:number;maxStart:number;anyLimb:boolean;jump:number;rest:number;paws:[number,number];lean:number}>>={
 leopard:{up:2,down:1.2,branch:.9,minRadius:.045,maxStart:Infinity,anyLimb:true,jump:1.6,rest:1.1,paws:[.35,.46],lean:.92},
 lion:{up:.9,down:.6,branch:.45,minRadius:.085,maxStart:1.8,anyLimb:false,jump:2.8,rest:.7,paws:[.47,.6],lean:.6},
};
const SLIP_HEIGHT=1.3,GRAVITY=9.8;
/** The nearest item within `within` units of p, the first one on a tie (what a filter, stable sort and [0] gave). */
function nearest<T extends {x:number;y:number}>(list:readonly T[],p:{x:number;y:number},within:number,ok:(t:T)=>boolean=()=>true):T|undefined{
 let best:T|undefined,bd=within*within;for(const t of list){const dx=t.x-p.x,dy=t.y-p.y,d=dx*dx+dy*dy;if(d<bd&&ok(t)){bd=d;best=t;}}return best;}
const nearestTree=(p:Player,room:Room)=>nearest(ofKind(props(room.seed),'tree'),p,TREE_REACH);
/** Can this animal climb into this tree at all (the resting bough low and thick enough for it)? */
export function canClimb(species:Species,ps:Prop[],t:Prop){
 const c=CLIMB[species];if(!c)return false;const T=tree(ps,t),k=restLimb(T),fake={species,limbDir:1} as Player;
 return T.limbs[k].start<=c.maxStart*UNITS_PER_METRE&&limbPoint(T,k,limbRange(T,k,fake)[0]).r>=c.minRadius*UNITS_PER_METRE;
}
export function endClimb(p:Player){p.climb='';p.perched=false;p.perchHeight=0;p.tree=-1;p.goal=-1;p.vh=0;}
const restLimb=(T:Tree)=>T.limbs.findIndex(l=>l.rest);
/** The trunk face an animal climbs to reach limb k: to one side of where the limb leaves, so at the top it turns onto it. */
function faceFor(T:Tree,k:number,from:number){
 // of the two faces, the one whose head-room is clearer of the crown branches (then the nearer one)
 const a=T.limbs[k].angle,faces=[a+Math.PI/2,a-Math.PI/2],room=(f:number)=>Math.min(...T.limbs.filter((_,i)=>i!==k).map(l=>Math.abs(wrap(l.angle-f))));
 const [l,r]=faces,dl=room(l),dr=room(r);return Math.abs(dl-dr)>.2?(dl>dr?l:r):Math.abs(wrap(l-from))<Math.abs(wrap(r-from))?l:r;
}
/** How far out along limb k the body can sit: its rump clear of the trunk, its nose short of the tip, and the wood at
 *  least as thick as the species needs. */
function limbRange(T:Tree,k:number,p:Player,dir=p.limbDir??1){
 // facing out along the bough the rump must clear the trunk; facing the trunk, the head must
 const c=CLIMB[p.species]!,U=UNITS_PER_METRE,[front,rear]=BODY[p.species],l=T.limbs[k],lo=T.axis(l.start).r+(dir<0?front:rear)*1.1*U;
 let hi=lo;for(let d=lo;d<=l.length-front*.7*U;d+=1){if(limbPoint(T,k,d).r<c.minRadius*U)break;hi=d;}
 return[lo,Math.max(lo,hi)];
}
/** Q: climb the nearest acacia (if this animal can), or start down again. */
export function perch(p:Player,room:Room,now:number){p.feeding=undefined;
 const c=CLIMB[p.species];if(!c||p.deadUntil||(p.stunUntil??0)>now)return;
 const ps=props(room.seed);
 if(p.climb){
  if(p.climb==='drop'||p.climb==='slip'||p.climb==='approach'&&(endClimb(p),true))return;
  // a lion jumps down off its bough; a leopard walks back to the trunk and climbs down head first
  if(p.species==='lion'&&p.climb==='limb'){jumpDown(p,ps,(p.heading??0)+Math.PI/2);notify(p,'Down from the tree.',now);}
  else{p.goal=-1;notify(p,'Climbing down.',now);}
  return;
 }
 const t=nearestTree(p,room);
 if(!t){notify(p,'Move closer to an acacia, then press Q to climb.',now);return;}
 const T=tree(ps,t),k=restLimb(T),high=!canClimb(p.species,ps,t);
 Object.assign(p,{tree:ps.indexOf(t),climb:'approach' as Climb,goal:high?-2:k,ch:0,limb:k,along:0,limbDir:1,mount:0,vh:0,climbHold:0,dx:0,dy:0,vx:0,vy:0,perched:true,perchHeight:0});
 p.side=faceFor(T,k,Math.atan2(p.y-t.y,p.x-t.x));
 notify(p,high?'That bough is too high for a lion, but it tries…':p.species==='lion'?'Scrambling up into the low bough.':'Climbing the acacia.',now);
}
function jumpDown(p:Player,ps:Prop[],angle:number){const pose=climbPose(ps,p);Object.assign(p,{climb:'drop' as Climb,side:angle,mount:2.2*UNITS_PER_METRE,vh:1*UNITS_PER_METRE,perchHeight:pose?.h??0});}
/** A leopard's ambush: it leaves the bough and lands on the prey below (the prey is taken at once). */
function dropOnto(p:Player,ps:Prop[],q:Player){
 const pose=climbPose(ps,p),h=pose?.h??0,g=GRAVITY*UNITS_PER_METRE,vh=1.5*UNITS_PER_METRE,t=(vh+Math.sqrt(vh*vh+2*g*h))/g,d=dist(p,q);
 Object.assign(p,{climb:'drop' as Climb,side:Math.atan2(q.y-p.y,q.x-p.x),mount:Math.max(1.5*UNITS_PER_METRE,(d-8)/t),vh,perchHeight:h});
}
/** One step of climbing. Every transition is driven by where the body actually is (height on the trunk, distance along
 *  the limb, height above the ground), not by a timer. Input moves the animal along whatever it is on. */
function climbStep(p:Player,dt:number,ps:Prop[],now:number){
 const c=CLIMB[p.species],t=ps[p.tree??-1];p.vx=0;p.vy=0;
 if(!c||!t||t.kind!=='tree'){endClimb(p);return;}
 const T=tree(ps,t),U=UNITS_PER_METRE,input=Math.hypot(p.dx,p.dy)>.1,step=(v:number)=>v*U*dt;
 const toward=(v:number,goal:number,rate:number)=>v<goal?Math.min(goal,v+rate):Math.max(goal,v-rate);
 switch(p.climb){
 case 'approach':{
  // walk round to the climbing face: circle the trunk at a body's clearance, then step in until the forepaws touch bark
  const stand=T.axis(0).r+BODY[p.species][0]*U,clear=T.axis(0).r+(BODY[p.species][2]+.25)*U,ang=Math.atan2(p.y-t.y,p.x-t.x),rad=Math.hypot(p.x-t.x,p.y-t.y),dA=wrap((p.side??0)-ang);
  const goal=Math.abs(dA)>.5?{a:ang+Math.sign(dA)*Math.min(Math.abs(dA),.6),r:Math.max(rad,clear)}:{a:p.side??0,r:stand};
  const gx=t.x+Math.cos(goal.a)*goal.r,gy=t.y+Math.sin(goal.a)*goal.r,d=Math.hypot(gx-p.x,gy-p.y),v=ANIMALS[p.species].gait.walk*1.6*U;
  if(Math.abs(dA)<.05&&Math.abs(rad-stand)<1.5){p.climb=p.goal===-2?'slip':'trunk';p.ch=0;p.mount=0;p.heading=(p.side??0)+Math.PI;return;}
  const k=Math.min(1,v*dt/Math.max(d,.001));p.vx=(gx-p.x)/Math.max(dt,1e-3)*k;p.vy=(gy-p.y)/Math.max(dt,1e-3)*k;p.x+=(gx-p.x)*k;p.y+=(gy-p.y)*k;p.heading=Math.atan2(p.vy,p.vx);
  return;
 }
 case 'slip':{
  // a lion at a trunk too tall for it: rears and scrabbles up a little way, can't get a grip, slides back down
  if((p.mount??0)<1){p.ch=toward(p.ch??0,SLIP_HEIGHT*U,step(c.up));if(p.ch>=SLIP_HEIGHT*U)p.mount=1;}
  else{p.ch=toward(p.ch??0,0,step(2.2));if(p.ch<=0){const back=climbPose(ps,p);endClimb(p);if(back){p.x=back.x;p.y=back.y;}notify(p,'Too high: lions only manage low, thick boughs.',now);return;}}
  break;
 }
 case 'trunk':{
  const goal=p.goal??-1,gh=goal>=0?T.limbs[goal].start:0;
  if(goal>=0){const face=faceFor(T,goal,p.side??0);p.side=(p.side??0)+clamp(wrap(face-(p.side??0)),-step(c.up)/T.axis(p.ch??0).r,step(c.up)/T.axis(p.ch??0).r);}
  p.ch=toward(p.ch??0,gh,step(gh>(p.ch??0)?c.up:c.down));
  if(goal<0&&(p.ch??0)<=c.jump*U){jumpDown(p,ps,p.side??0);return;}
  if(goal>=0&&p.ch===gh&&Math.abs(wrap(faceFor(T,goal,p.side??0)-(p.side??0)))<.01){p.climb='mount';p.limb=goal;p.mount=0;p.limbDir=1;p.along=limbRange(T,goal,p,1)[0];}
  break;
 }
 case 'mount':{
  // pulling up from the trunk onto the bough (mount 0 -> 1), or back off it (1 -> 0) to climb down or change bough
  const len=Math.max(.6*U,BODY[p.species][0]*U),on=p.goal===p.limb;
  p.mount=toward(p.mount??0,on?1:0,step((c.up+c.branch)/2)/len);
  if(on&&p.mount===1){p.climb='limb';p.limbDir=1;}
  if(!on&&p.mount===0){p.climb='trunk';p.ch=T.limbs[p.limb!].start;}
  break;
 }
 case 'limb':{
  const [lo,hi]=limbRange(T,p.limb!,p),L=limbPoint(T,p.limb!,p.along!),hl=Math.hypot(L.tx,L.ty)||1;
  // keep the body clear of the trunk for the way it now faces (shuffling out a little after turning to face the trunk)
  p.along=toward(p.along!,clamp(p.along!,lo,hi),step(c.branch));
  if(now<(p.climbHold??0))break;
  // turning round on a bough: crouch and pivot in place before walking the other way
  const turn=(dir:number)=>{if(dir===p.limbDir)return false;p.limbDir=dir;p.climbHold=now+(Math.PI/ANIMALS[p.species].gait.turnRate+.3)*1000;return true;};
  if(p.goal!==p.limb){if(turn(-1))break;p.along=toward(p.along!,lo,step(c.branch));if(p.along===lo){p.climb='mount';p.mount=1;}break;}
  if(!input)break;
  const s=(p.dx*L.tx+p.dy*L.ty)/hl/Math.hypot(p.dx,p.dy);
  if(Math.abs(s)>.35){const dir=s>0?1:-1;if(!turn(dir))p.along=clamp(p.along!+dir*step(c.branch),lo,hi);}
  // at the trunk end, pushing towards another bough climbs over to it (leopards only)
  if(c.anyLimb&&p.along!<=lo+1&&s<.35){const want=Math.atan2(p.dy,p.dx);let best=-1,score=.6;T.limbs.forEach((l,k)=>{const sc=Math.cos(l.angle-want);if(k!==p.limb&&sc>score){score=sc;best=k;}});if(best>=0)p.goal=best;}
  break;
 }
 case 'drop':{
  // jumping down: a short ballistic arc, landing feet first a couple of metres out
  p.vh=(p.vh??0)-GRAVITY*U*dt;p.perchHeight=(p.perchHeight??0)+(p.vh??0)*dt;
  const hs=p.mount??0;p.x+=Math.cos(p.side??0)*hs*dt;p.y+=Math.sin(p.side??0)*hs*dt;p.heading=p.side??0;
  if((p.perchHeight??0)<=0){endClimb(p);p.vx=Math.cos(p.heading)*hs*.5;p.vy=Math.sin(p.heading)*hs*.5;({x:p.x,y:p.y}=collide(p,p.x,p.y,ps));if(p.strikeAmbush)p.strikeAt=now;}
  return;
 }
 }
 const pose=climbPose(ps,p);if(pose){p.x=pose.x;p.y=pose.y;p.perchHeight=pose.h;p.heading=pose.heading;}
}
/** Where a climbing body is: the point under its origin (game x/y), its height above the ground at the trunk's foot,
 *  which way it faces, its pitch (nose up +), and what it stands on. Shared by the rules and the renderer, so both put
 *  the animal on the same bark. */
export function climbPose(ps:Prop[],p:Pick<Player,'species'|'x'|'y'|'heading'|'climb'|'tree'|'ch'|'side'|'limb'|'along'|'limbDir'|'goal'|'mount'|'perchHeight'>){
 const c=CLIMB[p.species],t=ps[p.tree??-1];if(!c||!t||!p.climb||p.climb==='approach')return null;
 const T=tree(ps,t),U=UNITS_PER_METRE;
 if(p.climb==='drop')return{x:p.x,y:p.y,h:Math.max(0,p.perchHeight??0),heading:p.side??0,pitch:-.25,on:'air' as const};
 const onTrunk=(h:number,down:boolean)=>{
  // rearing: standing nose to the bark, the body pivots up on its hind paws while the forepaws walk up the trunk,
  // until it hangs on the bark
  const hind=c.paws[1]*U,phi=down?-Math.PI*.46:Math.asin(clamp(h/hind,0,1))*c.lean,a=T.axis(h),side=p.side??0;
  const off=a.r+(down?0:BODY[p.species][0]*U*Math.cos(phi));
  return{x:a.x+Math.cos(side)*off,y:a.y+Math.sin(side)*off,h,heading:down?side:side+Math.PI,pitch:phi,on:'trunk' as const};
 };
 const onLimb=(k:number,along:number,dir:number)=>{
  const L=limbPoint(T,k,along),hl=Math.hypot(L.tx,L.ty)||1,
   // stand on the top of the bark: the radius along the limb's upward normal
   nx=-L.th*L.tx/hl,ny=-L.th*L.ty/hl,nh=hl,n=Math.hypot(nx,ny,nh);
  return{x:L.x+nx/n*L.r,y:L.y+ny/n*L.r,h:L.h+nh/n*L.r,heading:Math.atan2(L.ty,L.tx)+(dir<0?Math.PI:0),pitch:Math.atan2(L.th,hl)*dir,on:'limb' as const};
 };
 if(p.climb==='trunk'||p.climb==='slip')return onTrunk(p.ch??0,p.climb==='trunk'&&(p.goal??-1)<0);
 if(p.climb==='limb')return onLimb(p.limb!,p.along!,p.limbDir??1);
 // mount: from hanging on the trunk to standing on the bough. The body first turns toward the bough while still upright
 // (its head up and clear), then levels out onto it; it swings out from the trunk and up over the bark on the way, so
 // no part of it passes through the wood.
 const k=p.limb!,m=p.mount??0,sm=(a:number,b:number)=>{const x=clamp((m-a)/(b-a),0,1);return x*x*(3-2*x);},e=sm(0,1),down=(p.goal??-1)<0,
  // (going down it is the reverse: it turns on the bough first, then tips head first onto the trunk)
  eh=down?sm(.4,1):sm(0,.6),ep=down?sm(0,.65):sm(.2,.9);
 const a=onTrunk(T.limbs[k].start,down),b=onLimb(k,limbRange(T,k,p as Player,p.goal===k?1:-1)[0],p.goal===k?1:-1);
 const mx=a.x+(b.x-a.x)*e,my=a.y+(b.y-a.y)*e,ax=T.axis(a.h),ox=mx-ax.x,oy=my-ax.y,ol=Math.hypot(ox,oy)||1,bulge=Math.sin(Math.PI*m)*.35*U;
 return{x:mx+ox/ol*bulge,y:my+oy/ol*bulge,h:a.h+(b.h-a.h)*e+Math.sin(Math.PI*m)*.25*U,heading:a.heading+wrap(b.heading-a.heading)*eh,pitch:a.pitch+(b.pitch-a.pitch)*ep,on:m<.5?'trunk' as const:'limb' as const};
}
/** True when q stands in the rear arc of p (more than about 110° off the way p faces): where a zebra's hind legs reach. */
export const behind=(p:Player,q:{x:number;y:number})=>Math.cos(Math.atan2(q.y-p.y,q.x-p.x)-(p.heading??0))<-.35;
export function useAbility(p:Player,room:Room,now:number){p.feeding=undefined;if(now<p.abilityReady||p.deadUntil)return;
 if(p.climb){notify(p,'Press Q to climb down first.',now);return;}
 if(p.species==='warthog'){const burrow=props(room.seed).filter(t=>t.kind==='burrow'&&dist(t,p)<BURROW_REACH).sort((a,b)=>dist(a,p)-dist(b,p))[0];if(!burrow){notify(p,'Find a burrow first: a dark hole in open ground.',now);return;}const sa=idHash(p.id)*6.28;p.x=burrow.x+Math.cos(sa)*5;p.y=burrow.y+Math.sin(sa)*5;p.dx=0;p.dy=0;if(p.threatAt&&now-p.threatAt<3000)award(p,'tusks');}
 if(p.species==='zebra'){const close=room.players.filter(q=>!q.deadUntil&&q.protectedUntil<now&&ANIMALS[q.species].prey.includes('zebra')&&dist(q,p)<KICK_RANGE),kicked=close.filter(q=>behind(p,q));if(kicked.length)dropShield(p,now);if(close.length&&!kicked.length)notify(p,'Missed: a kick only reaches behind you.',now);for(const q of kicked){q.stunUntil=now+2500;const d=Math.max(1,dist(q,p));q.x=Math.max(25,Math.min(W-25,q.x+(q.x-p.x)/d*20));q.y=Math.max(25,Math.min(H-25,q.y+(q.y-p.y)/d*20));notify(q,'Kicked by a zebra! Stunned.',now);}if(kicked.length){award(p,'kick');p.score+=4;notify(p,'Kick landed +4',now);}}
 if(p.species==='hyena')p.stamina=100,p.exhausted=false;
 if(p.species==='impala'){const g=Math.hypot(p.vx,p.vy)||1,h=Math.hypot(p.dx,p.dy)>.1?Math.atan2(p.dy,p.dx):Math.atan2(p.vy,p.vx),v=Math.max(g,LEAP_SPEED*UNITS_PER_METRE);p.vx=Math.cos(h)*v;p.vy=Math.sin(h)*v;}
 p.abilityUntil=now+ANIMALS[p.species].duration*1000;p.abilityReady=now+ANIMALS[p.species].cooldown*1000;if(p.species!=='zebra')notify(p,ANIMALS[p.species].ability+'!',now);}
export const RESTART_CAUSE='started a new life.';
/** The menu's New life: allowed, but it is a death like any other (a longer wait, and the next animal starts no
 *  better fed or watered than this one was), so throwing a life away is never a shortcut to food or a better spot. */
export function restartLife(p:Player,room:Room,now:number){if(p.deadUntil)return;p.carry={hunger:p.hunger,thirst:p.thirst??100};die(p,room,now,RESTART_CAUSE);p.deadUntil=now+6000;}
export function die(p:Player,room:Room,now:number,cause:string){if(cause===RESTART_CAUSE&&!p.carry){restartLife(p,room,now);return;}if(p.deadUntil)return;
 if(!p.bot)(p.lives??=[]).push({species:p.species,seconds:Math.round(p.survivalSeconds),points:p.score-(p.lifeStart??0),food:p.food,hunts:p.hunts,cause});p.feeding=undefined;if(p.scorch)p.scorch=0;if(p.smokeUntil)p.smokeUntil=0;p.deadUntil=now+2600;p.dx=0;p.dy=0;p.vx=0;p.vy=0;endClimb(p);p.strikeId='';p.strikeAt=0;p.strikeAmbush=false;p.deaths++;notify(p,cause,now);if(!p.bot){room.events.unshift(p.name+' '+cause);room.events=room.events.slice(0,5);}}
// A kill leaves a carcass for scavengers once the hunter has eaten. Old carcasses dry out.
function dropCarcass(room:Room,x:number,y:number,now:number){room.foods=room.foods.filter(f=>!f.until||f.until>now);if(room.foods.length>620)return;const id=Math.max(0,...room.foods.map(f=>f.id))+1;room.foods.push({id,x,y,kind:'carrion',ready:now+7500,until:now+90000});}
export function interact(p:Player,room:Room,now:number){if(p.deadUntil||p.feeding||now<p.interactReady||p.strikeId)return;if((p.stunUntil??0)>now){notify(p,'Still reeling from the kick.',now);return;}p.interactReady=now+650;p.actionUntil=now+500;
 if(p.stunUntil>now){notify(p,'Still stunned.',now);return;}
 const a=ANIMALS[p.species],ambush=p.species==='leopard'&&p.climb==='limb';
 const reach=(ambush?AMBUSH_RANGE:p.abilityUntil>now&&(p.species==='lion'||p.species==='leopard')?POUNCE_RANGE:a.catchRange)*HUNT_REACH_MULTIPLIER*(perkOf(p)==='bite'?1+PERK_SIZE.bite:1);
 const victims=room.players.filter(q=>q.id!==p.id&&!q.deadUntil&&q.protectedUntil<now&&canTake(p,q,room)&&!hidden(q,room,now)&&!leaping(q,now)&&dist(p,q)<reach);victims.sort((x,y)=>dist(p,x)-dist(p,y));
 if(p.climb&&!ambush)return;
 // A catch is a committed lunge: aimed at prey in front, with nothing solid in between, and it lands a quarter of a
 // second later (the prey sees the hunter gather itself and can still leap, kick or break away). A leopard's ambush
 // is a leap from the bough that is checked when it lands.
 if(victims.length&&!ambush){const ps=props(room.seed),q=victims.find(q=>inFront(p,q)&&!contactBlocked(ps,p,q));
  if(!q){notify(p,'Missed: face your prey, with nothing in the way.',now);return;}
  p.strikeId=q.id;p.strikeTargetBorn=q.born;p.strikeAt=now+STRIKE_WINDUP;p.strikeAmbush=false;p.strikeBorn=p.born;p.strikeDir=Math.atan2(q.y-p.y,q.x-p.x);q.threatAt=now;notify(p,'Lunge!',now);dropShield(p,now);notify(q,'Lunge! '+a.name+' right on you',now);p.heading=Math.atan2(q.y-p.y,q.x-p.x);return;}
 if(victims[0]&&ambush){const q=victims[0];dropShield(p,now);dropOnto(p,props(room.seed),q);p.strikeId=q.id;p.strikeTargetBorn=q.born;p.strikeAt=0;p.strikeAmbush=true;p.strikeBorn=p.born;return;}
 if(ambush){notify(p,'No prey below. Wait for it to come closer.',now);return;}
 const f=nearest(room.foods,p,FOOD_RANGE,f=>f.ready<=now&&(!f.until||f.until>now)&&(a.foods as string[]).includes(f.kind)&&!grassGone(room,f,now));
 // a full animal can't keep eating for points (the same rule as water)
 if(f&&p.hunger>=FULL){notify(p,'Not hungry yet.',now);return;}
 if(f){if(f.until&&a.prey.length)award(p,'vultures');if(f.until)f.until=now;else f.ready=now+(f.kind==='carrion'?CARRION_REGROW:18000);p.food++;if(f.kind==='carrion')p.scavenged++;// the green flush after a fire: young shoots are richer than the old dry grass, worth more and more filling
 const flush=f.kind==='grass'&&burnAt(room,f.x,f.y,now)==='flush';p.hunger=Math.min(100,p.hunger+(f.kind==='carrion'?35:flush?36:28));const points=(savannaEvent(room,now).kind==='forage'?5:3)+(f.kind==='carrion'&&p.species==='hyena'?2:0)+(flush?3:0);p.score+=points;notify(p,(f.kind==='carrion'?'Scavenged ':f.kind==='roots'?'Dug up roots ':flush?'Green shoots ':'Food found ')+'+'+points,now);return;}
 if(nearWater(props(room.seed),p.x,p.y,WATER_REACH)){
  // water refills thirst (not food) and only scores when the animal really needed it
  if((p.thirst??100)>=THIRSTY){notify(p,'Not thirsty yet.',now);return;}
  p.drinks++;p.thirst=100;p.score+=2;notify(p,'A long drink +2',now);return;}
 if(!p.bot)notify(p,p.species==='hyena'&&room.players.some(q=>q.species==='zebra'&&!q.deadUntil&&dist(p,q)<a.catchRange*1.5)?'A zebra is too big alone: bring two more hyenas close.':'Move closer to your food, water or suitable prey.',now);
}
/** The moment a lunge lands (or a leopard lands from its leap): the prey must still be there, catchable, in reach and
 *  in front, with nothing solid between. Otherwise it got away. */
/** The prey is still ahead of the lunge (a cat twists in the air to follow prey that jinks, but can't catch one that
 *  has slipped behind it), or already under the hunter. */
const lungeLine=(p:Player,q:Player)=>dist(p,q)<12||Math.cos(Math.atan2(q.y-p.y,q.x-p.x)-(p.strikeDir??strikeDirection(p)))>0;
export function resolveStrike(p:Player,room:Room,now:number){
 const q=room.players.find(o=>o.id===p.strikeId&&(p.strikeTargetBorn===undefined||o.born===p.strikeTargetBorn)),a=ANIMALS[p.species],ambush=!!p.strikeAmbush,ps=props(room.seed),life=p.strikeBorn;
 p.strikeId='';p.strikeAt=0;p.strikeAmbush=false;if(p.deadUntil||life!==p.born)return;
 if((p.stunUntil??0)>now){notify(p,'Missed: knocked off balance.',now);return;}
 const reach=(ambush?a.catchRange*1.3:p.abilityUntil>now&&(p.species==='lion'||p.species==='leopard')?POUNCE_RANGE:a.catchRange)*1.15*HUNT_REACH_MULTIPLIER*(perkOf(p)==='bite'?1+PERK_SIZE.bite:1);
 const caught=!!q&&!q.deadUntil&&q.protectedUntil<now&&canTake(p,q,room)&&!hidden(q,room,now)&&!leaping(q,now)&&dist(p,q)<reach&&(ambush||lungeLine(p,q))&&!contactBlocked(ps,p,q);
 if(q&&!caught&&!q.deadUntil&&leaping(q,now)&&dist(p,q)<reach*1.5)award(q,'bound');
 if(!q||!caught){notify(p,ambush?'Missed: the prey moved before you landed.':'Missed: it broke away.',now);if(q&&!q.deadUntil)q.threatAt=now;return;}
 // A valid landed hunt is lethal; range, cover, protection and defensive abilities were checked above.
 q.feeding=undefined;if(ambush)award(p,'canopy');if(p.species==='hyena'&&q.species==='zebra')award(p,'clan');
 die(q,room,now,'was caught by a '+a.name.toLowerCase()+'.');dropCarcass(room,q.x,q.y,now);const duration=FEED_SECONDS[p.species]*1000;p.feeding={until:now+duration,duration,last:now};p.dx=p.dy=p.vx=p.vy=0;p.hunts++;p.food++;
 const points=(savannaEvent(room,now).kind==='hunt'?15:10)+(ambush?3:0)+(q.lane?5:0);p.score+=points;notify(p,(ambush?'Ambush! ':q.lane?'Hunt at the migration ':'Successful hunt ')+'+'+points,now);
}
export const STRIKE_WINDUP=250;
/** Badge 'Unseen at 10 m': a player's predator closing in (moving towards it at 0.3 m/s or more, past its spawn
 *  protection) within 10 m of live prey it could take, which neither sees, smells nor hears it right now (the same
 *  sense() the wildlife uses) and isn't already running from something. Standing still while prey wanders close
 *  isn't a stalk. */
export const STALK_BADGE_RANGE=10*UNITS_PER_METRE;
export function stalkedClose(p:Player,room:Room,ps:Prop[],t:number){
 if(p.protectedUntil>t)return;
 for(const q of room.players)if(q!==p&&!q.deadUntil&&q.mood!=='flee'&&Math.abs(q.x-p.x)<STALK_BADGE_RANGE&&dist(p,q)<STALK_BADGE_RANGE&&((q.x-p.x)*p.vx+(q.y-p.y)*p.vy)/Math.max(1,dist(p,q))>=.3*UNITS_PER_METRE&&canTake(p,q,room)&&!hidden(q,room,t)&&!sense(q,p,room,t,ps)){award(p,'stalk10');return;}
}
/** The first-seconds coaching line for each animal: what to do, in the order a new player needs it. */
export const COACH:Record<Species,string>={
 lion:'Turn on Tracking to find prey. Creep in close, Charge, face it and Eat / Hunt.',
 leopard:'Turn on Tracking to find prey. Stalk in close, or Climb tree and Eat / Hunt to drop on prey below.',
 hyena:'Follow circling vultures to carcasses. Tireless lets you run down a warthog or impala.',
 zebra:'Eat to graze and drink when Water runs low. Stay with the herd; Kick stuns a predator right behind you.',
 impala:'Eat to graze. If something charges, sprint and Leap just before it lunges.',
 warthog:'Eat to dig up roots. Keep a burrow close: Burrow hides you when danger comes.'};
/** Why a life ended, in a sentence a player can learn from. */
export function deathLesson(cause:string,species:Species){
 if(/lion/.test(cause))return species==='zebra'?'Lions tire after a short sprint. Keep it behind you and kick.':'Lions sprint hard but briefly. Break line of sight, jink, or outlast the charge.';
 if(/leopard/.test(cause))return 'Leopards ambush from cover and from acacia boughs. Watch the trees and use Tracking (F).';
 if(/hyena/.test(cause))return 'Hyenas run for kilometres. Use your burst early and get to cover or a burrow.';
 if(/food/.test(cause))return ANIMALS[species].prey.length?'Hunger ran out. Carcasses (under circling vultures) tide you over between hunts.':'Hunger ran out. Eat whenever the Food meter drops below 90%.';
 if(/fire/.test(cause))return 'A grass fire\'s head races downwind but its flanks creep. Run crosswind, or dash through a thin flame front onto the burnt ground behind it.';
 if(/new life/.test(cause))return 'You chose a fresh start. Points you earned stay with you.';
 return 'Every life is a fresh start in the chain.';
}
/** an old carcass on the plains, once picked clean, is replaced by another only after a few minutes: carrion tides a
 *  predator over between hunts but can't feed it for good (grass and roots regrow in 18 s) */
export const CARRION_REGROW=150000;
type Task={label:string;value:number;target:number;points:number};
export function tasks(p:Player,now:number):Task[]{
 // staying alive pays more the longer a life lasts (10, 20, 30... a minute), so ending a life early never pays
 const k=p.survived??0,survive={label:k?`Stay alive to ${k+1} minutes`:'Survive this life for 60 seconds',value:Math.floor(p.survivalSeconds)-60*k,target:60,points:10*(k+1)};
 const hunts=(target:number)=>({label:`Complete ${target} hunt${target>1?'s':''}`,value:p.hunts,target,points:30});
 const graze=(label:string)=>({label,value:p.food,target:4,points:30});
 const drink={label:'Drink at a watering hole',value:p.drinks,target:1,points:25};
 const hide=(label:string)=>({label,value:Math.floor(p.hiddenSeconds),target:8,points:25});
 const second:Record<Species,[Task,Task]>={
  lion:[hunts(1),drink],
  leopard:[hunts(1),hide('Stay hidden for 8 seconds')],
  hyena:[hunts(1),{label:'Scavenge 3 carcasses',value:p.scavenged,target:3,points:25}],
  zebra:[graze('Graze 4 times'),drink],
  impala:[graze('Eat 4 food items'),{label:'Escape 2 predators',value:p.escapes,target:2,points:25}],
  warthog:[graze('Root out 4 food items'),hide('Hide in a burrow or thicket for 8 s')],
 };
 return[...second[p.species],survive];
}
export function tick(room:Room,now:number){
 for(const p of room.players){p.vx??=0;p.vy??=0;p.sprint??=false;p.stamina??=100;p.perched??=false;p.perchHeight??=0;p.actionUntil??=0;p.survivalSeconds??=0;p.stunUntil??=0;p.drinks??=0;p.scavenged??=0;p.heading??=0;p.mood??='wander';p.alert??=0;p.targetId??='';p.moodUntil??=0;p.alarmAt??=0;p.calledAt??=0;p.lastThreatAt??=0;p.homeX??=p.x;p.homeY??=p.y;p.herd??='';p.nextDrink??=0;p.thinkAt??=0;p.stuckX??=p.x;p.stuckY??=p.y;p.stuckAt??=0;p.unstickUntil??=0;}
 const limit=room.duration===0?now:room.ends;
 if(room.phase!=='playing'){room.tick=now;return;}
 const humans=room.players.filter(p=>!p.bot&&!p.deadUntil);
 const total=Math.min(1.5,Math.max(0,(Math.min(now,limit)-room.tick)/1000)),ps=props(room.seed),steps=Math.ceil(total/.1);
 for(let s=0;s<steps;s++){
 const dt=total/steps,t=Math.min(now,limit)-(steps-1-s)*dt*1000;stepMigration(room,t);const bodies=bodyGrid(room.players);let gone=false;
 for(const p of room.players){
 if(!p.bot&&t-p.lastSeen>8000){p.dx=0;p.dy=0;p.feeding=undefined;continue;}
 // a migrating zebra that is caught, or has walked off the north edge, leaves the plains for good
 if(p.lane&&(p.deadUntil?t>=p.deadUntil:p.y<70)){p.deadUntil=-1;gone=true;continue;}
 if(p.deadUntil){if(t>=p.deadUntil)respawn(p,t,room);continue;}
 if(p.bot&&!p.feeding)steer(p,room,ps,t,dt,humans);
 // a player's keys are kept through a slow request or two (a phone on mobile data); a dropped connection stops the animal
 else if(t-p.inputAt>2000){p.dx=0;p.dy=0;}
 stepFeeding(p,t);move(p,dt,ps,t,bodiesNear(bodies,p.x,p.y));breathe(p,dt,t);
 p.survivalSeconds+=dt;p.thirst=Math.max(0,(p.thirst??100)-dt*THIRST_RATE);
 // food runs down at its own pace; a parched animal burns through it twice as fast
 p.hunger-=dt*HUNGER_RATE[p.species]*(p.thirst<=0?2:1);
 if(p.strikeId&&p.strikeAt&&t>=p.strikeAt)resolveStrike(p,room,t);
 if(p.hunger<=0){die(p,room,t,'ran out of food.');continue;}
 if(stepFire(p,room,t,dt))continue;stepTrek(p,room,t,dt);
 if(!p.bot&&ANIMALS[p.species].prey.length&&!p.badges?.includes('stalk10'))stalkedClose(p,room,ps,t);
 if(hidden(p,room,t)||stalking(p,t)&&(inThicket(ps,p.x,p.y)||inTallGrass(ps,p.x,p.y)))p.hiddenSeconds+=dt;
 // Being hunted means a predator is actually after you (a wild one has picked you and is charging, or a player's
 // predator within 15 m is running at you), not merely that one is somewhere nearby.
 const threat=room.players.some(q=>!q.deadUntil&&!hidden(q,room,t)&&ANIMALS[q.species].prey.includes(p.species)&&(q.bot?q.mood==='chase'&&q.targetId===p.id:dist(p,q)<150&&((p.x-q.x)*(q.vx||0)+(p.y-q.y)*(q.vy||0))/Math.max(1,dist(p,q))>40));
 if(threat)p.threatAt=t;else if(p.threatAt&&t-p.threatAt>3000){p.escapes++;const points=savannaEvent(room,t).kind==='escape'?10:5;p.score+=points;p.threatAt=0;notify(p,'Escaped a threat +'+points,t);}
 tasks(p,t).forEach((task,i)=>{if(i===2){if(task.value>=task.target){p.survived=(p.survived??0)+1;p.score+=task.points;notify(p,'Still alive +'+task.points,t);}return;}if(!p.claimed[i]&&task.value>=task.target){p.claimed[i]=true;if(i<2&&!p.bot)(p.done??=[]).push(p.species+':'+i);p.score+=task.points;notify(p,'Task complete +'+task.points,t);}});
 }if(gone)room.players=room.players.filter(p=>p.deadUntil!==-1);}room.tick=now;if(room.duration!==0&&now>=room.ends){room.phase='finished';room.players.forEach(p=>{p.dx=0;p.dy=0;p.vx=0;p.vy=0;});room.events.unshift('Round complete. Every life counted.');}}
// ---------------------------------------------------------------- wildlife
// (an alias, so the linter's React-hook naming rule doesn't mistake the ability for a hook)
const activate=useAbility;
// Herds: zebra and impala graze in herds, warthogs in small family groups, hyenas in pairs; cats live alone here. Each
// group starts in its habitat (see habitat above).
const HERD:Record<Species,number>={lion:1,leopard:1,hyena:2,zebra:5,impala:7,warthog:3};
function placeWildlife(room:Room,now:number){
 const r=rng(room.seed+room.round*101),ps=props(room.seed),anchors=new Map<string,{x:number;y:number}>(),count:Partial<Record<Species,number>>={};
 WILDLIFE.forEach((s,i)=>{
  const n=count[s]=(count[s]??0)+1,herd=s+Math.floor((n-1)/HERD[s]);let a=anchors.get(herd);
  if(!a){for(let k=0;k<40&&!a;k++){const q=habitat(s,r);if([...anchors.values()].every(o=>dist(o,q)>380)||k>30)a=q;}a??={x:W/2,y:H/2};anchors.set(herd,a);}
  const p=newPlayer('wild-'+i,ANIMALS[s].name,now,true,s);
  for(let k=0;k<12;k++){const ang=r()*Math.PI*2,d=HERD[s]>1?20+r()*(s==='warthog'?50:90):0,x=a.x+Math.cos(ang)*d,y=a.y+Math.sin(ang)*d;if(!blocked(ps,x,y,30)||k===11){p.x=x;p.y=y;break;}}
  Object.assign(p,{herd,homeX:a.x,homeY:a.y,stuckX:p.x,stuckY:p.y,heading:r()*Math.PI*2,mood:ANIMALS[s].prey.length?'patrol':'graze'});room.players.push(p);
 });
}
/** A wild animal's next life starts 15–25 m from its herd, away from players, and walks back in to regroup. */
function rejoinHerd(p:Player,room:Room,now:number){
 const ps=props(room.seed),mates=room.players.filter(q=>q.bot&&q.herd===p.herd&&q.id!==p.id&&!q.deadUntil),centre=mates.length?{x:mates.reduce((s,q)=>s+q.x,0)/mates.length,y:mates.reduce((s,q)=>s+q.y,0)/mates.length}:{x:p.homeX,y:p.homeY};
 let spot=safePoint(Math.floor(roll(room)*1e6));
 for(let k=0;k<24;k++){const a=roll(room)*Math.PI*2,d=150+roll(room)*100+k*10,x=Math.max(80,Math.min(W-80,centre.x+Math.cos(a)*d)),y=Math.max(80,Math.min(H-80,centre.y+Math.sin(a)*d));if(blocked(ps,x,y,30)||fireNear(room,{x,y},now,20000)||room.players.some(q=>!q.bot&&!q.deadUntil&&dist(q,{x,y})<300))continue;spot={x,y};break;}
 p.x=p.stuckX=spot.x;p.y=p.stuckY=spot.y;
 p.homeX=centre.x;p.homeY=centre.y;p.mood=ANIMALS[p.species].prey.length?'patrol':'regroup';p.moodUntil=now+15000;
}
type Plan={goal?:{x:number;y:number};pace:number};
// Prey: notice danger through sight, scent and sound (sense), grow wary, watch, then bolt. A bolting animal's alarm call
// warns animals nearby after a short, individual reaction time, and each one flees at its own angle.
function grazer(p:Player,room:Room,ps:Prop[],t:number,think:number):Plan{
 let best=0,cue:Cue|null=null,src:Player|undefined;
 for(const q of room.players){if(q===p||q.deadUntil||!ANIMALS[q.species].prey.includes(p.species)||dist(p,q)>400)continue;const c=sense(p,q,room,t,ps);if(!c)continue;const w=(c.how==='close'?4:c.how==='sight'?1.4:c.how==='scent'?.9:.7)*(1.4-Math.min(1,c.range/300));if(w>best){best=w;cue=c;src=q;}}
 if(src&&cue){p.alert=Math.min(2,p.alert+think*best*1.2);p.lastThreatAt=t;
  // sight shows exactly where the predator is; scent and sound only give a rough direction
  const blur=cue.how==='sight'||cue.how==='close'?0:(idHash(p.id+src.id)-.5)*1.2,ang=Math.atan2(src.y-p.y,src.x-p.x)+blur;p.threatX=p.x+Math.cos(ang)*cue.range;p.threatY=p.y+Math.sin(ang)*cue.range;}
 else p.alert=Math.max(0,p.alert-think*.25);
 let alarmed=false;if(p.alarmAt&&t>=p.alarmAt){p.alarmAt=0;p.alert=Math.max(p.alert,1.05);p.lastThreatAt=t;alarmed=true;}
 if(p.alert>=1&&p.mood!=='flee'){
  p.mood='flee';p.moodUntil=t+3000+idHash(p.id)*1500;
  if(!alarmed){p.calledAt=t;for(const q of room.players)if(q.bot&&q!==p&&!q.deadUntil&&!ANIMALS[q.species].prey.length&&q.mood!=='flee'&&!q.alarmAt&&dist(q,p)<260){q.alarmAt=t+150+roll(room)*650;q.threatX=p.threatX;q.threatY=p.threatY;}}
 }
 if(p.mood==='flee'){
  if(t>p.moodUntil&&t-p.lastThreatAt>2500){p.mood='regroup';p.moodUntil=t+12000;p.alert=.3;}
  else{
   p.sprint=true;let ax=p.x-p.threatX,ay=p.y-p.threatY;const n=Math.hypot(ax,ay)||1,bias=(idHash(p.id)-.5)*1.3,c=Math.cos(bias),s=Math.sin(bias);ax/=n;ay/=n;
   let goal={x:p.x+(ax*c-ay*s)*300,y:p.y+(ax*s+ay*c)*300};
   if(p.species==='warthog'){const b=ps.filter(o=>o.kind==='burrow'&&dist(o,p)<400).sort((x,y)=>dist(x,p)-dist(y,p))[0];if(b){const ready=t>p.abilityReady,a=idHash(p.id)*6.28;
    // a burrow it can't use yet: wait at the mouth, each hog at its own spot, rather than all on the hole
    goal=ready?b:{x:b.x+Math.cos(a)*16,y:b.y+Math.sin(a)*16};if(ready&&dist(p,b)<BURROW_REACH)activate(p,room,t);}}
   else if(src&&t>p.abilityReady&&(p.species==='zebra'?dist(src,p)<KICK_RANGE&&behind(p,src)&&roll(room)<.04:dist(src,p)<70))activate(p,room,t);
   return{goal,pace:1};
  }
 }
 if(p.alert>=.4){p.mood='watch';p.heading=Math.atan2(p.threatY-p.y,p.threatX-p.x);return{pace:0};}
 if(p.mood==='watch')p.mood='graze';
 // a migrating zebra keeps walking north along its lane: no stopping to drink or graze, back on the line after a scare
 if(p.lane){p.mood='wander';
  // wedged among a kopje's boulders: back out away from the nearest one for a few seconds, then rejoin the line
  if(t<p.unstickUntil+2300){if(!p.targetX){const b=solidNear(ps,p.x,p.y,120).sort((a,c)=>dist(a,p)-dist(c,p))[0],n=b?Math.max(1,dist(b,p)):1;p.targetX=b?p.x+(p.x-b.x)/n*220:p.x+(idHash(p.id)-.5)*300;p.targetY=b?p.y+(p.y-b.y)/n*220+60:p.y+150;}return{goal:{x:p.targetX,y:p.targetY},pace:.5};}
  p.targetX=0;
  const y=p.y-260,f=1-Math.max(0,y)/H;p.homeX=p.x;p.homeY=y;return{goal:{x:p.lane[0]+(p.lane[1]-p.lane[0])*f,y},pace:TREK_PACE};}
 const mates=p.herd?room.players.filter(q=>q.bot&&q.herd===p.herd&&q!==p&&!q.deadUntil&&dist(q,p)<700):[];
 if(mates.length){p.homeX=(p.x+mates.reduce((s,q)=>s+q.x,0))/(mates.length+1);p.homeY=(p.y+mates.reduce((s,q)=>s+q.y,0))/(mates.length+1);}
 const centre={x:p.homeX,y:p.homeY};
 if(p.mood==='regroup'){if(dist(p,centre)<90||t>p.moodUntil)p.mood='graze';else return{goal:centre,pace:.6};}
 if(p.mood==='drink'||(t>p.nextDrink||(p.thirst??100)<35)&&p.hunger>40){
  // the herd walks to the nearest watering hole now and then: tracks and predators gather there too
  p.mood='drink';const w=ps.filter(o=>o.kind==='water').sort((x,y)=>dist(x,p)-dist(y,p))[0],n=Math.max(1,dist(p,w));
  if(nearWater(ps,p.x,p.y,WATER_REACH-6)){p.nextDrink=t+70000+roll(room)*60000;p.mood='graze';p.drinks++;p.thirst=100;return{pace:0};}
  return{goal:{x:w.x+(p.x-w.x)/n*(w.size+12),y:w.y+(p.y-w.y)/n*(w.size+12)},pace:.5};
 }
 if(dist(p,centre)>170)return{goal:centre,pace:.55};
 const range=p.hunger<60?600:260;let food:Food|undefined,fd=range;
 const eats=ANIMALS[p.species].foods as string[],hungry=p.hunger<60;fd*=fd;
 const fire=worldEvent(room,t)?.kind==='fire';
 for(const f of room.foods){const dx=f.x-p.x,dy=f.y-p.y;let d=dx*dx+dy*dy;if(d>=fd||f.ready>t||f.until&&f.until<t||!eats.includes(f.kind))continue;
  // grazers seek out the green flush on burnt ground (it counts as a quarter of the distance), and skip burnt grass
  if(fire&&f.kind==='grass'){const b=burnAt(room,f.x,f.y,t);if(b==='flames'||b==='burnt')continue;if(b==='flush'){d*=.0625;if(d>=fd)continue;}}
  if(hungry||dist(f,centre)<300){fd=d;food=f;}}
 p.mood='graze';
 if(food)return{goal:food,pace:headDown(p,t)?.15:.35};
 if(!p.targetX||dist(p,{x:p.targetX,y:p.targetY})<40){const a=roll(room)*Math.PI*2,d=roll(room)*160;p.targetX=Math.max(80,Math.min(W-80,centre.x+Math.cos(a)*d));p.targetY=Math.max(80,Math.min(H-80,centre.y+Math.sin(a)*d));}
 return{goal:{x:p.targetX,y:p.targetY},pace:.3};
}
// Predators: they hunt only prey they have noticed, creep in (swinging crosswind so the breeze doesn't carry their scent
// ahead), charge from close range, and give up a chase that runs long, then rest in shade before hunting again.
// Lions rarely charge from beyond ~30 m and seldom run more than 100–200 m; hyenas wear prey down over longer runs.
/** Below this food level a wild predator goes looking for prey. Lions and hyena clans take any good chance at a
 *  zebra herd (real lions hunt opportunistically when prey comes close, even after eating); leopards are choosier. */
const KEEN:Partial<Record<Species,number>>={lion:97,hyena:97,leopard:85};
/** By day the wild hunters mostly lie up: lions rest through much of the day and do most of their hunting after dark,
 *  hyenas are mainly nocturnal, leopards hunt by night and at dawn and dusk but also by day. All of them still take a
 *  good chance in daylight, so in full day they only set out when this much hungrier (game values). */
export const DAY_REST:Partial<Record<Species,number>>={lion:22,hyena:16,leopard:10};
export const CHASE={lion:{start:150,give:5000,walk:.35},leopard:{start:110,give:4000,walk:.3},hyena:{start:230,give:12000,walk:.55}} as const;
function hunter(p:Player,room:Room,ps:Prop[],t:number):Plan{
 const a=ANIMALS[p.species],c=CHASE[p.species as keyof typeof CHASE],keen=(KEEN[p.species]??85)-(DAY_REST[p.species]??0)*lightAt(room,t).day;
 if(p.mood==='rest'&&t<p.moodUntil){const tree=nearest(ofKind(ps,'tree'),p,500);return{goal:tree?{x:tree.x+22,y:tree.y+6}:undefined,pace:.3};}
 let q=p.targetId?room.players.find(o=>o.id===p.targetId):undefined;
 if(q&&(q.deadUntil||hidden(q,room,t)))q=undefined;
 if(q){if(sense(p,q,room,t,ps))p.lastThreatAt=t;else if(t-p.lastThreatAt>2500)q=undefined;}
 // a clan mate already after something: join the hunt (hyenas converge on a chase)
 if(!q&&p.species==='hyena'&&p.hunger<keen){const mate=room.players.find(o=>o!==p&&o.bot&&o.species==='hyena'&&!o.deadUntil&&o.targetId&&(o.mood==='chase'||o.mood==='stalk')&&dist(o,p)<400);const m=mate&&room.players.find(o=>o.id===mate.targetId);if(m&&!m.deadUntil&&!hidden(m,room,t)){q=m;p.targetId=m.id;p.lastThreatAt=t;p.mood=mate.mood;p.chaseStart=t;}}
 if(!q&&p.hunger<keen){let best=Infinity;for(const o of room.players){if(o===p||o.deadUntil||o.protectedUntil>t||!canTake(p,o,room,CLAN_RANGE*2))continue;const like=PREFERENCE[p.species]?.[o.species]??1;if(like<1&&p.hunger>=70)continue;const d=dist(p,o)/like;if(d<best&&dist(p,o)<400&&sense(p,o,room,t,ps)){best=d;q=o;}}if(q){p.targetId=q.id;p.lastThreatAt=t;p.mood='stalk';}}
 if(!q){
  p.targetId='';if(p.mood==='chase'||p.mood==='stalk')p.mood='patrol';
  if(p.species==='leopard'&&p.hunger>75&&t>p.abilityReady&&nearestTree(p,room)){perch(p,room,t);return{pace:0};}
  if(p.hunger>=keen){p.mood='rest';p.moodUntil=t+8000;return{pace:0};}
  // circling vultures give a carcass away from far off: scavengers head for any within 70 m
  const carcass=nearest(room.foods,p,700,f=>f.kind==='carrion'&&f.ready<=t&&(!f.until||f.until>t));
  if(carcass)return{goal:carcass,pace:.6};
  p.mood='patrol';
  // a hyena clan travels together behind its first member, so it is a clan when it meets a zebra herd
  if(p.species==='hyena'&&p.herd){const lead=room.players.find(o=>o.herd===p.herd&&o.species==='hyena'&&!o.deadUntil);if(lead&&lead!==p&&dist(lead,p)<900)return{goal:{x:lead.x-(lead.vx||0)*.6+(idHash(p.id)-.5)*80,y:lead.y-(lead.vy||0)*.6+(idHash(p.id+'y')-.5)*80},pace:dist(lead,p)>160?.6:.4};}
  // lions and hyenas know where the zebra herds graze and work towards them (real lions hunt the herds around water)
  if((p.species==='lion'||p.species==='hyena')&&(!p.targetX||dist(p,{x:p.targetX,y:p.targetY})<50)&&roll(room)<.6){const zs=room.players.filter(o=>o.species==='zebra'&&!o.deadUntil);if(zs.length){const z=zs[Math.floor(roll(room)*zs.length)],ang=roll(room)*Math.PI*2,d=180+roll(room)*120;p.targetX=Math.max(80,Math.min(W-80,z.homeX+Math.cos(ang)*d));p.targetY=Math.max(80,Math.min(H-80,z.homeY+Math.sin(ang)*d));if(p.species==='lion'){p.homeX=p.targetX;p.homeY=p.targetY;}}}
  if(!p.targetX||dist(p,{x:p.targetX,y:p.targetY})<50){const w=ps.filter(o=>o.kind==='water');const r=roll(room);if(r<.4){const o=w[Math.floor(roll(room)*w.length)],ang=roll(room)*Math.PI*2;p.targetX=o.x+Math.cos(ang)*(o.size+90);p.targetY=o.y+Math.sin(ang)*(o.size+90);}else{const ang=roll(room)*Math.PI*2,d=150+roll(room)*350;p.targetX=Math.max(80,Math.min(W-80,p.homeX+Math.cos(ang)*d));p.targetY=Math.max(80,Math.min(H-80,p.homeY+Math.sin(ang)*d));}}
  return{goal:{x:p.targetX,y:p.targetY},pace:.35};
 }
 const d=dist(p,q);
 if(p.mood!=='chase'){
  // prey that has bolted is chased only if it is still close; otherwise the stalk is blown and the hunter moves on
  const bolted=q.mood==='flee'||speedOf(q)>walkPace(q.species)*1.05;
  if(d<c.start||bolted&&d<c.start*1.5){p.mood='chase';p.chaseStart=t;if(t>p.abilityReady&&p.species!=='leopard')activate(p,room,t);}
  else if(bolted){p.targetId='';p.mood='patrol';p.targetX=0;return{pace:0};}
  else{
   p.mood='stalk';if(p.species==='leopard'&&t>p.abilityReady&&d<230)activate(p,room,t);
   const w=wind(room);let gx=(q.x-p.x)/d,gy=(q.y-p.y)/d;
   if(gx*w.x+gy*w.y>.5){const side=idHash(p.id)>.5?1:-1;gx-=w.y*side*.9;gy+=w.x*side*.9;}
   return{goal:{x:p.x+gx*100,y:p.y+gy*100},pace:c.walk};
  }
 }
 if(t-p.chaseStart>c.give||d>c.start*2.6){p.mood='rest';p.moodUntil=t+9000+roll(room)*6000;p.targetId='';return{pace:0};}
 p.sprint=true;return{goal:{x:q.x+(q.vx||0)*.3,y:q.y+(q.vy||0)*.3},pace:1};
}
function steer(p:Player,room:Room,ps:Prop[],t:number,dt:number,humans:Player[]){
 // cheaper wildlife far from every player: decisions a few times a second instead of every step
 if(t<p.thinkAt)return;
 const far=!humans.some(h=>dist(h,p)<1600),think=far?.4:dt;p.thinkAt=far?t+400:0;
 const a=ANIMALS[p.species];
 if(p.climb){p.dx=0;p.dy=0;if(p.climb!=='limb')return;
  const below=room.players.some(q=>!q.deadUntil&&a.prey.includes(q.species)&&q.protectedUntil<t&&dist(q,p)<AMBUSH_RANGE);
  if(below)interact(p,room,t);else if(p.hunger<55||roll(room)<.002)perch(p,room,t);
  // otherwise settle a body length out along the bough, where leopards lie up
  else{const T=tree(ps,ps[p.tree!]),L=limbPoint(T,p.limb!,p.along!),want=CLIMB[p.species]!.rest*UNITS_PER_METRE;if(p.along!<want-2&&p.goal===p.limb){const l=Math.hypot(L.tx,L.ty)||1;p.dx=L.tx/l*.6;p.dy=L.ty/l*.6;}}
  return;}
 p.sprint=false;
 let plan=a.prey.length?hunter(p,room,ps,t):grazer(p,room,ps,t,think);
 // every animal gets out of the way of a fire front coming at it (see fireEscape)
 {const away=fireEscape(room,p,t);if(away&&!p.perched){plan={goal:away,pace:1};p.sprint=dist(p,away)<200;if(p.mood==='chase'||p.mood==='stalk'){p.mood='patrol';p.targetId='';}}}
 if(p.perched){p.dx=0;p.dy=0;return;}
 const d=plan.goal?dist(p,plan.goal):0;p.dx=plan.goal&&d>8?(plan.goal.x-p.x)/d*plan.pace:0;p.dy=plan.goal&&d>8?(plan.goal.y-p.y)/d*plan.pace:0;
 // keep a little space between animals of a kind, so a herd never piles into one spot
 for(const q of room.players){if(q===p||q.deadUntil||q.species!==p.species)continue;const ox=p.x-q.x,oy=p.y-q.y,o=Math.hypot(ox,oy);if(o<40&&o>.01){p.dx+=ox/o*(1-o/40)*.5;p.dy+=oy/o*(1-o/40)*.5;}}
 // never run off the plains: drop the outward part of the heading near an edge and slide along it
 const fleeing=p.mood==='flee',slide=idHash(p.id)>.5?1:-1;
 if(p.x<100&&p.dx<0||p.x>W-100&&p.dx>0){p.dx=0;if(fleeing&&Math.abs(p.dy)<.3)p.dy=slide;}
 if(p.y<100&&p.dy<0&&!p.lane||p.y>H-100&&p.dy>0){p.dy=0;if(fleeing&&Math.abs(p.dx)<.3)p.dx=slide;}
 // steer around trunks and boulders before collision instead of running into them forever
 for(const tree of solidNear(ps,p.x,p.y,90)){
  const ox=tree.x-p.x,oy=tree.y-p.y,clearance=solidRadius(tree)+BODY[p.species][0]*UNITS_PER_METRE+8;
  if(Math.hypot(ox,oy)<clearance&&ox*p.dx+oy*p.dy>0){const side=p.dx*oy-p.dy*ox>=0?-1:1,angle=side*.9;const dx=p.dx*Math.cos(angle)-p.dy*Math.sin(angle);p.dy=p.dx*Math.sin(angle)+p.dy*Math.cos(angle);p.dx=dx;break;}
 }
 // stuck (pushing into a kopje, wedged between boulders): side-step for a moment and pick a new wander target
 if(t-p.stuckAt>1500){if(Math.hypot(p.dx,p.dy)>.2&&Math.hypot(p.x-p.stuckX,p.y-p.stuckY)<12){p.unstickUntil=t+1200;p.targetX=0;}p.stuckX=p.x;p.stuckY=p.y;p.stuckAt=t;}
 if(t<p.unstickUntil){const dx=p.dx;p.dx=-p.dy*slide;p.dy=dx*slide;}
 // a hunter in a chase lunges only once its quarry is in reach (pressing early would waste the lunge's cooldown)
 if(a.prey.length&&p.mood==='chase'){const q=room.players.find(o=>o.id===p.targetId),reach=p.abilityUntil>t&&(p.species==='lion'||p.species==='leopard')?POUNCE_RANGE:a.catchRange;if(q&&dist(p,q)<reach*.9)interact(p,room,t);}
 else if(p.hunger<90||!a.prey.length)interact(p,room,t);
}
export function publicRoom(room:Room,now:number){return{...room,players:room.players.map(({token,bag,strikeId,strikeBorn,strikeDir,done,carry,...p})=>({...p,online:p.bot||now-p.lastSeen<8000,concealed:hidden(p,room,now)&&!p.perched})),serverTime:now};}

// Balance abstractions: health is not a biological measurement. Matchups remain canTake().
export const HUNT_DAMAGE:Partial<Record<Species,number>>={lion:60,leopard:52,hyena:48};
export const FEED_SECONDS:Record<Species,number>={lion:5,hyena:6,leopard:7,zebra:0,impala:0,warthog:0};
export function stepFeeding(p:Player,now:number){const f=p.feeding;if(!f)return;
 if(p.deadUntil||p.stunUntil>now||Math.hypot(p.dx,p.dy)>.1){p.feeding=undefined;notify(p,'Feeding stopped. You can move.',now);return;}
 const elapsed=Math.max(0,Math.min(now,f.until)-f.last);p.hunger=Math.min(100,p.hunger+45*elapsed/f.duration);f.last=Math.min(now,f.until);p.vx=p.vy=0;
 if(now>=f.until){p.feeding=undefined;notify(p,'Meal finished.',now);}}
/** Round lengths the host can pick, in seconds; 0 = no time limit (the host ends it). Rooms saved before this default to 300. */
export const DURATIONS=[300,600,0] as const;
export function finishRound(room:Room,now:number,_by:'host'='host'){room.phase='finished';room.ends=now;room.endedBy='host';for(const p of room.players){p.dx=p.dy=p.vx=p.vy=0;p.feeding=undefined;p.strikeId='';}room.events.unshift('The host ended the round.');}
