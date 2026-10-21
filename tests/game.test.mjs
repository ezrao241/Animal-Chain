import test from 'node:test';
import assert from 'node:assert/strict';
import {move,UNITS_PER_METRE,spawnPoint,W,H,ANIMALS,SPECIES,WILDLIFE,newPlayer,newRoom,start,respawn,die,tick,props,interact,savannaEvent,useAbility,perch,hidden,publicRoom,makeFoods,solid,solidRadius,KICK_RANGE,TREE_REACH} from '../lib/game.ts';
const NOW=1800000000000;
// an open patch of plain: no thicket (hiding), boulder, tree or water nearby
const OPEN=(()=>{for(let y=300;y<H-300;y+=50)for(let x=300;x<W-300;x+=50)if(props(417).every(p=>Math.hypot(p.x-x,p.y-y)>(p.kind==='water'?p.size+150:p.kind==='tallgrass'?p.size*100+150:150)))return{x,y};})();
function fixture(species='lion'){
 const player=newPlayer('test-host','Test Host',NOW,false,species);player.token='test-only-token';player.x=OPEN.x;player.y=OPEN.y;player.protectedUntil=0;
 const room=newRoom('TESTAB',player,NOW);Object.assign(room,{phase:'playing',started:NOW,ends:NOW+300000,foods:[]});return{room,player};
}
const near=(player,species,dx=10)=>{const q=newPlayer('q-'+species,species,NOW,true,species);Object.assign(q,{x:player.x+dx,y:player.y,protectedUntil:0});return q;};
test('six savanna species, five-minute rounds, two humans and 60 wildlife slots',()=>{
 assert.deepEqual([...SPECIES],['lion','leopard','hyena','zebra','impala','warthog']);
 const {room,player}=fixture();room.players.push(newPlayer('friend','Friend',NOW,false,'zebra'));const previous=room.players.map(p=>p.species);start(room,NOW);
 assert.equal(room.ends-room.started,300000);assert.equal(room.players.length,2+WILDLIFE.length);assert.equal(room.players[0].token,'test-only-token');
 room.players.slice(0,2).forEach((p,i)=>assert.notEqual(p.species,previous[i]));
 assert.equal(publicRoom(room,NOW).players.some(p=>'token' in p),false);
 const grazers=WILDLIFE.filter(s=>!ANIMALS[s].prey.length).length;assert.ok(grazers>WILDLIFE.length*.65,'mostly grazers');
});
test('predators only hunt prey their size can take',()=>{
 assert.ok(!ANIMALS.leopard.prey.includes('zebra'));assert.ok(!ANIMALS.hyena.prey.includes('zebra'));assert.ok(ANIMALS.lion.prey.includes('zebra'));
 for(const s of SPECIES)assert.ok(!ANIMALS[s].prey.includes('lion'));
 const {room,player}=fixture('leopard');const zebra=near(player,'zebra');room.players.push(zebra);interact(player,room,NOW);assert.equal(player.hunts,0);assert.equal(zebra.deadUntil,0);
 const impala=near(player,'impala',12);room.players.push(impala);interact(player,room,NOW+1000);assert.equal(player.hunts,1);assert.ok(impala.deadUntil);
});
test('a kill leaves a carcass that scavengers can eat',()=>{
 const {room,player}=fixture('lion');const prey=near(player,'warthog');room.players.push(prey);interact(player,room,NOW);
 const carcass=room.foods.find(f=>f.kind==='carrion');assert.ok(carcass);
 const hyena=newPlayer('h','H',NOW,true,'hyena');Object.assign(hyena,{x:carcass.x,y:carcass.y,protectedUntil:0});room.players.push(hyena);
 interact(hyena,room,NOW+1000);assert.equal(hyena.scavenged,0,'not ready while the hunter feeds');
 interact(hyena,room,NOW+6000);assert.equal(hyena.scavenged,1);assert.equal(hyena.score,5+2,"golden graze bonus plus the hyena scavenging bonus");
});
test('phase bonuses are real scoring',()=>{
 for(const [elapsed,points]of [[0,5],[100000,3],[200000,3]]){const{room,player}=fixture('zebra');room.foods=[{id:1,x:player.x,y:player.y,kind:'grass',ready:0}];interact(player,room,NOW+elapsed);assert.equal(player.score,points);}
 for(const [elapsed,points]of [[0,10],[100000,15],[200000,10]]){const{room,player}=fixture('lion');const victim=near(player,'impala');room.players.push(victim);interact(player,room,NOW+elapsed);assert.equal(player.score,points);}
 assert.deepEqual([0,100000,200000,300000].map(t=>savannaEvent({started:NOW},NOW+t).kind),['forage','hunt','escape','escape']);
});
test('zebra kick stuns a lion, impala leap and warthog burrow escape a catch',()=>{
 {const{room,player}=fixture('zebra');player.heading=Math.PI;const lion=near(player,'lion',KICK_RANGE-10);room.players.push(lion);useAbility(player,room,NOW);assert.ok(lion.stunUntil>NOW);interact(lion,room,NOW+100);assert.equal(lion.hunts,0);}
 {const{room,player}=fixture('impala');const lion=near(player,'lion',15);room.players.push(lion);useAbility(player,room,NOW);interact(lion,room,NOW+200);assert.equal(lion.hunts,0);}
 {const{room,player}=fixture('warthog');const burrow=props(417).find(p=>p.kind==='burrow');Object.assign(player,{x:burrow.x+20,y:burrow.y});useAbility(player,room,NOW);assert.equal(player.x,burrow.x);assert.ok(hidden(player,room,NOW+1000));}
});
test('leopards climb acacias and ambush from them',()=>{
 const{room,player}=fixture('leopard');const tree=props(417).find(p=>p.kind==='tree');Object.assign(player,{x:tree.x+TREE_REACH-5,y:tree.y});perch(player,room,NOW);
 assert.ok(player.perched);assert.ok(hidden(player,room,NOW));
 const impala=near(player,'impala',45);room.players.push(impala);interact(player,room,NOW+1000);assert.equal(player.hunts,1);assert.equal(player.perched,false);assert.equal(player.score,13);
});
test('drinking at a watering hole counts for the drink task',()=>{
 const{room,player}=fixture('lion');const water=props(417).find(p=>p.kind==='water');Object.assign(player,{x:water.x+water.size+10,y:water.y});interact(player,room,NOW);assert.equal(player.drinks,1);tick(room,NOW+200);assert.ok(player.claimed[1]);
});
test('human reincarnation changes species but keeps round score; wildlife keeps its slot',()=>{
 const {room,player}=fixture();player.score=125;die(player,room,NOW,'test');const previous=player.species;respawn(player,NOW+2600);
 assert.notEqual(player.species,previous);assert.equal(player.score,125);assert.equal(player.deaths,1);assert.equal(player.hunger,100);
 WILDLIFE.forEach((species,i)=>{const p=newPlayer('wild-'+i,'wild',NOW,true,species);respawn(p,NOW+3000);assert.equal(p.species,species);});
});
test('layout: props stay inside the map, food never spawns inside a boulder or a watering hole',()=>{
 const ps=props(417);for(const p of ps){assert.ok(p.x>0&&p.x<W&&p.y>0&&p.y<H);}
 for(const f of makeFoods(417)){assert.ok(!ps.some(p=>solid(p)&&Math.hypot(p.x-f.x,p.y-f.y)<solidRadius(p)));}
 const{room}=fixture();start(room,NOW);for(let t=1;t<=600;t++)tick(room,NOW+t*100);assert.equal(room.phase,'playing');
 for(const p of room.players)assert.ok(p.x>=25&&p.x<=W-25&&p.y>=25&&p.y<=H-25);
});

// ---------------------------------------------------------------- awareness, wildlife and defences
import {sense,wind,inTallGrass,sightBlocked,behind,CHASE,trails,GRASS_PATCH} from '../lib/game.ts';
const ps=props(417);
test('awareness: running is noticed farther than walking, standing still least, and only by real cues',()=>{
 const{room,player}=fixture('impala');const lion=near(player,'lion');room.players.push(lion);
 const w=wind(room);Object.assign(lion,{x:player.x+w.x*150,y:player.y+w.y*150});// lion downwind: its scent drifts away from the impala
 assert.equal(sightBlocked(ps,player,lion),false);
 Object.assign(lion,{vx:130,vy:0});assert.equal(sense(player,lion,room,NOW)?.how,'sight');
 Object.assign(lion,{vx:50,vy:0});assert.equal(sense(player,lion,room,NOW)?.how,'sight');
 Object.assign(lion,{vx:0,vy:0});assert.equal(sense(player,lion,room,NOW),null,'a still lion 15 m away goes unnoticed');
 Object.assign(lion,{x:player.x-w.x*150,y:player.y-w.y*150});assert.equal(sense(player,lion,room,NOW)?.how,'scent','upwind, the breeze carries its scent');
 Object.assign(lion,{x:player.x+30,y:player.y});assert.equal(sense(player,lion,room,NOW)?.how,'close');
});
test('cover: tall grass hides animals under a metre, never a lion or zebra standing in plain view',()=>{
 const patch=ps.find(p=>p.kind==='tallgrass'&&!ps.some(o=>o.kind==='rock'&&Math.hypot(o.x-p.x,o.y-p.y)<p.size*GRASS_PATCH+160));assert.ok(patch);
 const{room,player}=fixture('impala');Object.assign(player,{x:patch.x,y:patch.y});const w=wind(room);
 const watcher=near(player,'impala');
 assert.ok(inTallGrass(ps,patch.x,patch.y));
 for(const [species,seen] of [['leopard',false],['hyena',false],['lion',true],['zebra',true]]){const t=newPlayer('t-'+species,species,NOW,true,species);Object.assign(t,{x:patch.x,y:patch.y,vx:45,vy:0,dx:1,dy:0});
  // only a sight result counts here (scent may also reach the watcher)
  Object.assign(watcher,{x:patch.x+w.x*120,y:patch.y+w.y*120});assert.equal(sense(watcher,t,room,NOW)?.how==='sight',seen,species);}
});
test('cover: a boulder blocks the line of sight but not scent or sound',()=>{
 const rock=ps.filter(p=>p.kind==='rock').sort((a,b)=>b.size-a.size)[0],r=rock.size*32;
 const{room,player}=fixture('impala');const w=wind(room),side={x:-w.y,y:w.x};// crosswind line through the rock: no scent either way
 Object.assign(player,{x:rock.x-side.x*(r+20),y:rock.y-side.y*(r+20)});const lion=near(player,"lion");Object.assign(lion,{x:rock.x+side.x*(r+20),y:rock.y+side.y*(r+20),vx:50,vy:0});room.players.push(lion);
 assert.ok(sightBlocked(ps,player,lion));assert.notEqual(sense(player,lion,room,NOW)?.how,'sight');
 Object.assign(lion,{vx:130});assert.equal(sense(player,lion,room,NOW)?.how,'sound','a sprinting lion is heard behind the rock');
});
test('defences have limits: the zebra kick only reaches behind and has a cooldown',()=>{
 const{room,player}=fixture('zebra');player.heading=0;const lion=near(player,'lion',KICK_RANGE-10);room.players.push(lion);
 useAbility(player,room,NOW);assert.equal(lion.stunUntil,0,'lion in front of the zebra is not kicked');assert.ok(!behind(player,lion));
 player.heading=Math.PI;useAbility(player,room,NOW+1000);assert.equal(lion.stunUntil,0,'kick still cooling down');
 useAbility(player,room,NOW+ANIMALS.zebra.cooldown*1000+1);assert.ok(lion.stunUntil>NOW,'kick lands from behind after the cooldown');
 const far=near(player,'lion',-(KICK_RANGE+10));far.id='far';room.players.push(far);player.abilityReady=0;useAbility(player,room,NOW+20000);assert.equal(far.stunUntil,0,'out of reach');
});
test('every predator/prey matchup: only listed prey, in reach, unprotected and not escaping, can be caught',()=>{
 for(const hunter of SPECIES)for(const prey of SPECIES){if(hunter===prey)continue;
  const{room,player}=fixture(hunter);const q=near(player,prey,15);room.players.push(q);interact(player,room,NOW);
  assert.equal(!!q.deadUntil,ANIMALS[hunter].prey.includes(prey),hunter+' vs '+prey);
  if(!ANIMALS[hunter].prey.includes(prey))continue;
  const{room:r2,player:h2}=fixture(hunter);const shielded=near(h2,prey,15);shielded.protectedUntil=NOW+4000;r2.players.push(shielded);interact(h2,r2,NOW);assert.equal(shielded.deadUntil,0,'spawn protection '+hunter+' vs '+prey);
  const{room:r3,player:h3}=fixture(hunter);const away=near(h3,prey,ANIMALS[hunter].catchRange+5);r3.players.push(away);interact(h3,r3,NOW);assert.equal(away.deadUntil,0,'out of reach '+hunter+' vs '+prey);
 }
});
// a room with only wildlife: a lion placed by an impala herd that is grazing, everyone else far away
function herdScene(){const{room}=fixture('lion');room.players=[];start(room,NOW);room.players=room.players.filter(p=>p.bot);
 const herd=room.players.filter(p=>p.species==='impala'&&p.herd==='impala0'),lion=room.players.find(p=>p.species==='lion');return{room,herd,lion};}
test('herds scatter readably: alarm spreads with individual reaction times and flee angles',()=>{
 const{room,herd,lion}=herdScene();const c={x:herd.reduce((s,p)=>s+p.x,0)/herd.length,y:herd.reduce((s,p)=>s+p.y,0)/herd.length};
 Object.assign(lion,{x:c.x+60,y:c.y,hunger:40});
 const fled=new Map();for(let i=1;i<=60;i++){tick(room,NOW+i*100);for(const p of herd)if(p.mood==='flee'&&!fled.has(p.id))fled.set(p.id,{t:i*100,heading:p.heading});}
 assert.ok(fled.size>=herd.length-1,'nearly the whole herd bolts: '+fled.size+'/'+herd.length);
 const times=[...fled.values()].map(f=>f.t);assert.ok(Math.max(...times)-Math.min(...times)>=200,'not all at the same instant');
 assert.ok(herd.some(p=>p.calledAt),'someone gives an alarm call');
 const later=herd.filter(p=>!p.deadUntil).map(p=>Math.atan2(p.vy,p.vx));const spread=Math.max(...later)-Math.min(...later);assert.ok(spread>.3,'flee directions differ');
});
test('predators need an opportunity: a still animal goes unnoticed, a chase gives up instead of crossing the map',()=>{
 const{room,lion}=herdScene();room.players=[lion];lion.hunger=40;
 const prey=newPlayer('human','Human',NOW,false,'impala');Object.assign(prey,{protectedUntil:0,lastSeen:NOW+1e9,inputAt:NOW+1e9});const w=wind(room);
 Object.assign(prey,{x:Math.min(W-300,Math.max(300,lion.x)),y:Math.min(H-300,Math.max(300,lion.y))});Object.assign(lion,{x:prey.x-w.x*140,y:prey.y-w.y*140});// lion upwind: the impala's scent drifts away from it
 if(sightBlocked(ps,lion,prey)||inTallGrass(ps,prey.x,prey.y))return;
 room.players.push(prey);
 for(let i=1;i<=20;i++)tick(room,NOW+i*100);assert.equal(lion.targetId,'','a still impala 14 m away is not detected');
 // the impala bolts away from the lion: the lion notices, charges, and gives up within its chase limit
 Object.assign(lion,{x:prey.x-w.x*140,y:prey.y-w.y*140,vx:0,vy:0});
 let charged=0,gaveUp=0;for(let i=21;i<=200;i++){prey.dx=w.x;prey.dy=w.y;prey.sprint=true;prey.inputAt=NOW+i*100;tick(room,NOW+i*100);if(lion.mood==='chase'&&!charged)charged=i;if(charged&&lion.mood==='rest'&&!gaveUp)gaveUp=i;if(prey.deadUntil)break;}
 assert.ok(charged,'the lion reacts to the running impala');
 if(!prey.deadUntil)assert.ok(gaveUp&&(gaveUp-charged)*100<=CHASE.lion.give+600,'chase abandoned after '+((gaveUp-charged)*100)+' ms');
 assert.equal(prey.threatAt>0||prey.escapes>0,true,'the chase registered as being hunted');
});
test('being hunted means pursued: a resting lion nearby does not raise the alarm at spawn',()=>{
 const{room,player}=fixture('impala');player.lastSeen=NOW+1e9;player.inputAt=NOW+1e9;const lion=near(player,'lion',120);lion.hunger=100;room.players.push(lion);
 for(let i=1;i<=20;i++)tick(room,NOW+i*100);assert.equal(player.threatAt,0);
});
test('wildlife over three minutes: stays on the map, keeps moving, no piles, varied behaviour, reproducible',()=>{
 const run=()=>{const{room}=fixture();room.players=[];start(room,NOW);room.players=room.players.filter(p=>p.bot);const moods=new Set(),moved=new Map(room.players.map(p=>[p.id,0])),last=new Map(room.players.map(p=>[p.id,{x:p.x,y:p.y}]));
  for(let i=1;i<=1800;i++){tick(room,NOW+i*100);for(const p of room.players){moods.add(p.mood);const l=last.get(p.id);moved.set(p.id,moved.get(p.id)+Math.hypot(p.x-l.x,p.y-l.y));last.set(p.id,{x:p.x,y:p.y});}}
  return{room,moods,moved};};
 const a=run(),b=run();
 for(const p of a.room.players)assert.ok(p.x>=25&&p.x<=W-25&&p.y>=25&&p.y<=H-25,p.id+' left the map');
 const stationary=a.room.players.filter(p=>a.moved.get(p.id)<50);assert.ok(stationary.length<=4,'stuck animals: '+stationary.map(p=>p.id+':'+p.mood).join(','));
 // (a warthog family may share one burrow: they are underground, not piled up)
 const end=NOW+1800*100;for(const p of a.room.players)for(const q of a.room.players)if(p!==q&&!p.deadUntil&&!q.deadUntil&&!(hidden(p,a.room,end)&&hidden(q,a.room,end)))assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>2,'piled up: '+p.id+' '+q.id);
 for(const m of ['graze','patrol','drink'])assert.ok(a.moods.has(m),'mood seen: '+m+' in '+[...a.moods]);
 assert.deepEqual(a.room.players.map(p=>[Math.round(p.x),Math.round(p.y)]),b.room.players.map(p=>[Math.round(p.x),Math.round(p.y)]),'same seed, same savanna');
 assert.ok(trails().length>=4);
});
test('real locomotion: lions sprint briefly, hyenas run for kilometres, impala bound 10 m',()=>{
 const run=(species,seconds,sprint=true)=>{const{room,player}=fixture(species);Object.assign(player,{dx:1,dy:0,sprint});let top=0,start=player.x;for(let t=1;t<=seconds*20;t++){const now=NOW+t*50;Object.assign(player,{dx:1,dy:0,sprint,inputAt:now,lastSeen:now,hunger:100,protectedUntil:Infinity});room.players=[player];tick(room,now);top=Math.max(top,Math.hypot(player.vx,player.vy)/UNITS_PER_METRE);}return{top,player,metres:(player.x-start)/UNITS_PER_METRE};};
 const lion=run('lion',4);assert.ok(lion.top>20&&lion.top<=22.01,'lion tops out near 80 km/h: '+lion.top);
 const lionLong=run('lion',14),hyenaLong=run('hyena',14);assert.ok(lionLong.player.exhausted||lionLong.player.stamina<40,'a lion is spent after a short sprint');assert.ok(hyenaLong.player.stamina>60,'a hyena barely tires');
 const zebra=run('zebra',3,false);assert.ok(Math.abs(zebra.top-7)<.1,'cruising zebra');
 const{room,player}=fixture('impala');Object.assign(player,{dx:1,dy:0});const x0=player.x;useAbility(player,room,NOW);for(let t=0;t<18;t++)move(player,.05,[],NOW+t*50);
 assert.ok(Math.abs((player.x-x0)/UNITS_PER_METRE-10)<1.5,'impala bound is about 10 m: '+(player.x-x0)/10);
});
test('turning: a galloping zebra swings wide, an impala jinks tight',()=>{
 const radius=species=>{const{player}=fixture(species);Object.assign(player,{dx:1,dy:0,sprint:false});for(let t=0;t<200;t++)move(player,.05,[],NOW+t*50);player.dx=0;player.dy=1;const start=Math.atan2(player.vy,player.vx);let t=0;while(Math.atan2(player.vy,player.vx)-start<Math.PI/2-.01&&t<400){move(player,.05,[],NOW+t*50);t++;}return Math.hypot(player.vx,player.vy)/UNITS_PER_METRE*(t*.05)/(Math.PI/2);};
 assert.ok(radius('zebra')>radius('impala'));
});
test('spawning follows habitat: herds near water, warthogs by burrows',()=>{
 const ps=props(417),{room}=fixture();start(room,NOW);
 const zebras=room.players.filter(p=>p.bot&&p.species==='zebra');assert.ok(zebras.filter(z=>ps.some(w=>w.kind==='water'&&Math.hypot(w.x-z.x,w.y-z.y)<w.size+600)).length>=zebras.length*.8);
 assert.ok(zebras.filter(z=>zebras.some(o=>o!==z&&Math.hypot(o.x-z.x,o.y-z.y)<200)).length>=zebras.length*.8,'zebras come in herds');
 const hogs=room.players.filter(p=>p.bot&&p.species==='warthog');assert.ok(hogs.filter(h=>ps.some(b=>b.kind==='burrow'&&Math.hypot(b.x-h.x,b.y-h.y)<200)).length>=hogs.length*.7);
 for(let i=0;i<20;i++){const q=spawnPoint('impala',room,i);assert.ok(!room.players.some(o=>ANIMALS[o.species].prey.includes('impala')&&Math.hypot(o.x-q.x,o.y-q.y)<200),'no spawning under a predator\'s nose');}
});
