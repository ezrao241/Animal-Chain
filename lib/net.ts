// Room sessions shared by the multiplayer route (app/api/game/route.ts, rooms in D1) and the offline shim (play/api-shim.ts,
// rooms in memory): lobby membership and host succession, one-shot actions that run at most once, and what each player is
// sent. Rules stay in lib/game.ts; this file only decides who may do what, when, and who may see what.
import {newPlayer,start,tick,finishRound,useAbility as startAbility,perch,interact,restartLife,hidden,makeFoods,DURATIONS,stepFeeding,ANIMALS,LEAP_SPEED,UNITS_PER_METRE,W,H,type Room,type Player,type Food} from './game.ts';

export const ONLINE_MS=8000,        // a human who hasn't synced for this long is shown as away (tick() also freezes their input)
 GRACE_MS=15000,                    // a disconnected player keeps their place this long (a reload, a tunnel), then is removed
 HOST_GRACE_MS=GRACE_MS,            // and an away host keeps the room as long, then an online player takes over
 STALE_MS=GRACE_MS,                 // (kept as names for the two uses)
 IDLE_ROOM_MS=30*60000,             // nobody has synced for this long: the room is gone
 ACTION_MAX_AGE=1500,               // a one-shot press older than this (a long outage) is dropped rather than replayed late
 COALESCE_MS=60,                    // a sync carrying nothing new within this long of the last tick is answered from the stored state
 MAX_PLAYERS=8,
 CLAIM_SLACK=90;                    // how far (game units, 9 m) a reported position may run ahead of top speed: network jitter, banked between syncs

export type Action={id:number;kind:'ability'|'interact'|'perch';born:number;age?:number};
export type Outcome={status:number;body:Record<string,unknown>;save:boolean;remove?:boolean};
const fail=(status:number,error:string):Outcome=>({status,body:{error},save:false});
export const online=(p:Player,now:number)=>p.bot||now-p.lastSeen<ONLINE_MS;
const humans=(room:Room)=>room.players.filter(p=>!p.bot);

/** Drops long-gone humans outside a round (in a round they keep their animal and score) and hands the room on when the
 *  host has been away past the grace period, or has gone. The new host is the earliest-joined online player. */
export function settleRoom(room:Room,now:number){
 let changed=false;
 // finished results keep everyone who played; in the lobby and during a round a player gone past the grace period is removed
 if(room.phase!=='finished'){const keep=room.players.filter(p=>p.bot||now-p.lastSeen<STALE_MS);if(keep.length!==room.players.length){room.players=keep;changed=true;}}
 const people=humans(room),host=people.find(p=>p.id===room.host);
 if(host&&now-host.lastSeen<HOST_GRACE_MS)return changed;
 const next=people.find(p=>p.id!==room.host&&online(p,now))||(!host?people.slice().sort((a,b)=>b.lastSeen-a.lastSeen)[0]:undefined);
 if(next&&next.id!==room.host){room.host=next.id;next.message='You are now the host.';next.messageUntil=now+4000;changed=true;}
 else if(!next&&!host&&room.host){room.host='';changed=true;}
 return changed;
}

/** Runs one-shot presses at most once each: ids are per-player and increasing, so a retried or reordered request can't
 *  repeat one. A press made in an earlier life (born), while dead, outside a round, or too long ago is acknowledged and dropped. */
export function applyActions(p:Player,room:Room,list:unknown,now:number){
 if(!Array.isArray(list))return false;
 const actions=list.slice(0,8).filter((a):a is Action=>!!a&&Number.isSafeInteger(a.id)&&['ability','interact','perch'].includes(a.kind)).sort((a,b)=>a.id-b.id);
 let acted=false;
 for(const a of actions){
  if(a.id<=(p.act??0))continue;p.act=a.id;acted=true;
  if(room.phase!=='playing'||p.deadUntil||a.born!==p.born||(Number(a.age)||0)>ACTION_MAX_AGE)continue;
  if(a.kind==='ability')startAbility(p,room,now);else if(a.kind==='perch')perch(p,room,now);else interact(p,room,now);
 }
 return acted;
}

const clamp=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;
/** One request against a loaded room (create is handled by the caller, which owns the room store). Mutates the room;
 *  save says whether it must be written back, remove that the room is now empty and should be deleted. */
export function roomRequest(room:Room,b:Record<string,unknown>,action:string,now:number,uuid:()=>string):Outcome{
 // a retried request (or another Worker's slightly earlier clock) must never move the room's clock backwards, which
 // would simulate the same stretch of the round twice
 now=Math.max(now,room.tick||0);
 let p=room.players.find(q=>!q.bot&&typeof b.token==='string'&&q.id===b.id&&q.token===b.token);
 const seenBefore=p?.lastSeen??0;if(p)p.lastSeen=now;
 const settled=settleRoom(room,now);
 if(action==='join'){
  // a player who still holds a valid session for this room gets it back instead of a second animal
  if(p)return{status:200,body:{room:viewFor(room,p.id,now),id:p.id,token:p.token},save:true};
  const name=String(b.name||'').trim().slice(0,18);if(!name)return fail(400,'Choose a nickname first.');
  if(room.phase==='playing')return fail(409,'This round has started. Join the next room or ask the host to play again.');
  if(humans(room).length>=MAX_PLAYERS)return fail(409,`This room is full (${MAX_PLAYERS} players).`);
  p=newPlayer(uuid(),name,now);p.token=uuid();room.players.push(p);settleRoom(room,now);
  return{status:200,body:{room:viewFor(room,p.id,now),id:p.id,token:p.token},save:true};
 }
 if(!p)return fail(401,'Your session is no longer in this room. Please rejoin.');
 if(action==='sync'&&!settled&&quiet(p,seenBefore,room,b,now))return{status:200,body:{room:viewFor(room,p.id,room.phase==='playing'?room.tick:now)},save:false};
 tick(room,now);
 if(action==='configure'){
  // round length is chosen in the lobby by the host and kept for play-again; everyone sees it in the room state
  if(room.host!==p.id)return fail(403,'Only the host can change the round.');
  if(room.phase==='playing')return fail(409,'Choose the round length before starting.');
  if(!(DURATIONS as readonly unknown[]).includes(b.duration))return fail(400,'Choose 5 minutes, 10 minutes or unlimited.');
  room.duration=b.duration as Room['duration'];
 }else if(action==='end'){
  if(room.host!==p.id)return fail(403,'Only the host can end the round.');
  if(room.phase!=='playing')return fail(409,'No round is running.');
  finishRound(room,now,'host');
 }else if(action==='start'||action==='practice'){
  if(room.host!==p.id)return fail(403,'Only the host can start the round.');
  // a repeated click or a retried request finds the round already running and gets it, rather than a second round or an error
  if(room.phase==='playing')return!!room.practice===(action==='practice')?{status:200,body:{room:viewFor(room,p.id,now)},save:true}:fail(409,'The round is already running.');
  const active=humans(room).filter(q=>online(q,now)),practice=action==='practice';
  if(!practice&&active.length<2)return fail(409,'Invite one more player to start, or choose solo practice.');
  if(practice&&active.length!==1)return fail(409,'Solo practice is for one player. Start a multiplayer round instead.');
  room.practice=practice;room.players=active;start(room,now);
 }else if(action==='leave'){
  room.players=room.players.filter(q=>q.id!==p!.id);
  if(!humans(room).length)return{status:200,body:{left:true},save:false,remove:true};
  settleRoom(room,now);return{status:200,body:{left:true,room:viewFor(room,p.id,now)},save:true};
 }else if(action==='restart'){
  if(room.phase!=='playing')return fail(409,'Start the round first.');restartLife(p,room,now);
 }else if(room.phase==='playing'){
  const seq=Number(b.seq)||0;
  if(seq>p.seq){p.seq=seq;p.dx=clamp(b.dx);p.dy=clamp(b.dy);p.sprint=b.sprint===true;p.inputAt=now;stepFeeding(p,now);claim(p,b,now);}
  applyActions(p,room,b.actions,now);
 }
 return{status:200,body:{room:viewFor(room,p.id,now)},save:true};
}

/** The player's own device moves its animal every frame with the same move() rules (speeds, grip, stamina, collisions)
 *  and each sync reports where it got to. The server takes that position whenever the animal could have run there, so a
 *  player's own animal never snaps back to where the server last heard from it. Reach is checked against the species'
 *  top speed with a small banked allowance for network jitter (sustained running faster than top speed drains it). The
 *  server keeps the animal while it holds it (dead, climbing or in a tree, stunned by a kick, down a burrow); a refused
 *  position bumps fix, which tells the device to rejoin the server's animal. */
export function claim(p:Player,b:Record<string,unknown>,now:number){
 const x=Number(b.x),y=Number(b.y);
 if(b.x===undefined||!Number.isFinite(x)||!Number.isFinite(y)||b.born!==p.born)return;
 const g=ANIMALS[p.species].gait,U=UNITS_PER_METRE,top=Math.max(g.sprint,LEAP_SPEED)*U*1.1;
 if(p.anchorBorn!==p.born||p.anchorAt===undefined){p.anchorX=p.x;p.anchorY=p.y;p.anchorAt=now;p.anchorBorn=p.born;p.slack=CLAIM_SLACK;}
 const held=!!p.deadUntil||p.perched||!!p.climb||(p.stunUntil??0)>now||p.species==='warthog'&&p.abilityUntil>now;
 const elapsed=Math.min(1.5,Math.max(0,(now-p.anchorAt!)/1000)),d=Math.hypot(x-p.anchorX!,y-p.anchorY!),left=Math.min(CLAIM_SLACK,(p.slack??CLAIM_SLACK)+top*elapsed-d);
 if(held||left<0){
  if(Math.hypot(x-p.x,y-p.y)>15)p.fix=(p.fix??0)+1;
  p.anchorX=p.x;p.anchorY=p.y;p.anchorAt=now;p.slack=CLAIM_SLACK/2;return;
 }
 p.x=Math.max(25,Math.min(W-25,x));p.y=Math.max(25,Math.min(H-25,y));
 const vx=Number(b.vx)||0,vy=Number(b.vy)||0,v=Math.hypot(vx,vy),k=v>top?top/v:1;p.vx=vx*k;p.vy=vy*k;
 if(v>5)p.heading=Math.atan2(p.vy,p.vx);if(Math.abs(p.vx)>1)p.face=p.vx>0?1:-1;
 p.anchorX=p.x;p.anchorY=p.y;p.anchorAt=now;p.slack=left;
}

/** A sync that changes nothing (same input, no presses, recently seen, the room ticked a moment ago) is answered from the
 *  stored state as of its last tick, with no simulation step and no database write. */
function quiet(p:Player,seenBefore:number,room:Room,b:Record<string,unknown>,now:number){
 if(Array.isArray(b.actions)&&b.actions.some(a=>Number(a?.id)>(p.act??0)))return false;
 if(now-seenBefore>2000)return false;
 // a moving animal's reported position is news even when the keys held haven't changed
 if(b.x!==undefined&&Math.hypot(Number(b.x)-p.x,Number(b.y)-p.y)>2)return false;
 if(room.phase!=='playing')return true;
 return now-room.tick<COALESCE_MS&&clamp(b.dx)===p.dx&&clamp(b.dy)===p.dy&&(b.sprint===true)===!!p.sprint;
}

// Fields only the server (and the animal's own player) may see: credentials, input, AI plans and targets, task progress,
// private messages. Everything else describes what any animal on the plains could observe.
const SERVER_ONLY=['token','anchorX','anchorY','anchorAt','anchorBorn','slack','bag','seq','act','inputAt','lastSeen','strikeId','strikeBorn','strikeTargetBorn','strikeDir'] as const;
const OWNER_ONLY=['dx','fix','dy','targetX','targetY','targetId','threatX','threatY','lastThreatAt','threatAt','homeX','homeY','nextDrink','chaseStart','thinkAt','stuckX','stuckY','stuckAt','unstickUntil','moodUntil','alarmAt','message','messageUntil','hunger','thirst','claimed','food','hunts','drinks','scavenged','escapes','hiddenSeconds','survivalSeconds','abilityReady','interactReady','done','carry','lives','lifeStart','survived'] as const;
// Beyond FAR_VIEW (past the largest draw range, sound and sense ranges) an animal is never drawn or heard; it is sent with just
// what its tracks need (components/game/safari-traces.ts), about a quarter of the size.
export const FAR_VIEW=1150;
const FAR_FIELDS=['id','bot','species','x','y','vx','vy','heading','born','deadUntil','abilityUntil','perched','climb','online','concealed'] as const;
export type ViewPlayer=Omit<Player,typeof SERVER_ONLY[number]>&{online:boolean;concealed:boolean};
export type RosterEntry={id:string;name:string;species:Player['species'];score:number;deaths:number;online:boolean};
export type RoomView=Omit<Room,'players'|'foods'|'rs'>&{players:ViewPlayer[];foodChanges:Food[];roster:RosterEntry[];you:string;serverTime:number};

const baseFoodCache=new Map<number,Food[]>();
export const baseFoods=(seed:number)=>{let f=baseFoodCache.get(seed);if(!f)baseFoodCache.set(seed,f=makeFoods(seed));return f;};

/** What one player is sent. A concealed animal (in a thicket, burrowed, lying along a limb) is left out entirely for
 *  everyone but its own player, the same rule the renderer and sense() already apply; the roster still lists every human
 *  for the lobby and scores. Food is sent as changes from the seed's fixed layout. */
export function viewFor(room:Room,viewer:string,now:number):RoomView{
 const players:ViewPlayer[]=[],me=room.players.find(p=>p.id===viewer);
 for(const p of room.players){
  const own=p.id===viewer,concealed=!p.deadUntil&&hidden(p,room,now)&&!p.perched;
  if(concealed&&!own)continue;
  const full:Record<string,unknown>={...p,online:online(p,now),concealed};
  if(!own&&me&&Math.hypot(p.x-me.x,p.y-me.y)>FAR_VIEW){const far:Record<string,unknown>={};for(const k of FAR_FIELDS)if(full[k]!==undefined)far[k]=full[k];players.push(far as ViewPlayer);continue;}
  for(const k of SERVER_ONLY)delete full[k];
  if(!own)for(const k of OWNER_ONLY)delete full[k];
  if(p.bot){delete full.score;delete full.deaths;}
  if(own&&p.act)full.act=p.act;
  players.push(full as ViewPlayer);
 }
 const base=baseFoods(room.seed);
 // a seed food that has changed only needs its id and timers (its place and kind are fixed); a carcass is sent whole
 const foodChanges=room.foods.filter(f=>f.id>=base.length?!!f.until&&f.until>now:f.ready>now||!!f.until).map(f=>f.id>=base.length?f:{id:f.id,ready:f.ready,...f.until?{until:f.until}:{}} as Food);
 const rest:Partial<Room>={...room};delete rest.players;delete rest.foods;delete rest.rs;
 return{...rest as Omit<Room,'players'|'foods'|'rs'>,players,foodChanges,roster:humans(room).map(p=>({id:p.id,name:p.name,species:p.species,score:p.score,deaths:p.deaths,online:online(p,now)})),you:viewer,serverTime:now};
}

/** Client side: rebuild the full food table from the seed layout plus the changes. */
export function expandFoods(view:Pick<RoomView,'seed'|'foodChanges'>):Food[]{
 const changed=new Map(view.foodChanges.map(f=>[f.id,f]));
 return[...baseFoods(view.seed).map(f=>{const c=changed.get(f.id);return c?{...f,...c}:f;}),...view.foodChanges.filter(f=>f.id>=baseFoods(view.seed).length)];
}

/** Client side: the view in the shape the page and renderer use (a Room with the full food table). */
export const expandView=<V extends Pick<RoomView,'seed'|'foodChanges'>>(view:V)=>({...view,foods:expandFoods(view)});

/** JSON for the wire: fractional numbers (positions, velocities, angles) to two decimals, about a millimetre of game space. */
export const encode=(data:unknown)=>JSON.stringify(data,(_k,v)=>typeof v==='number'&&!Number.isInteger(v)?Math.round(v*100)/100:v);
