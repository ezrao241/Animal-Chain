import test from 'node:test';
import assert from 'node:assert/strict';
import {move,UNITS_PER_METRE,spawnPoint,W,H,ANIMALS,SPECIES,WILDLIFE,newPlayer,newRoom,start,respawn,die,tick,props,interact,savannaEvent,useAbility,perch,hidden,publicRoom,makeFoods,solid,solidRadius,KICK_RANGE,TREE_REACH} from '../lib/game.ts';
const NOW=1800000000000;
// an open patch of plain: no thicket (hiding), boulder, tree or water nearby
const OPEN=(()=>{for(let y=300;y<H-300;y+=50)for(let x=300;x<W-300;x+=50)if(props(417).every(p=>Math.hypot(p.x-x,p.y-y)>(p.kind==='water'?p.size+150:150)))return{x,y};})();
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
 {const{room,player}=fixture('zebra');const lion=near(player,'lion',KICK_RANGE-10);room.players.push(lion);useAbility(player,room,NOW);assert.ok(lion.stunUntil>NOW);interact(lion,room,NOW+100);assert.equal(lion.hunts,0);}
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
test('responsive steering: reversals plant and push off, sideways turns stay tight, release stops',()=>{
 const dt=1/60,go=(p,n)=>{for(let i=0;i<n;i++)move(p,dt,[],NOW);};
 for(const species of SPECIES){
  const g=ANIMALS[species].gait,mk=(dx,dy,sprint=false)=>{const{player}=fixture(species);Object.assign(player,{dx,dy,sprint,vx:0,vy:0});go(player,240);return player;};
  // running forward, then reverse: no loop, just a short skid of a couple of metres
  let p=mk(1,0);const x0=p.x;p.dx=-1;let ahead=0;for(let i=0;i<120;i++){go(p,1);ahead=Math.max(ahead,(p.x-x0)/UNITS_PER_METRE);}
  assert.ok(ahead<3,species+' reversal skid '+ahead.toFixed(1)+' m');assert.ok(p.vx<0&&Math.abs(p.vy)<1,species+' now running the other way');
  // flat-out sprint, then a 90 degree turn: the path bends within about 20 m (it used to drift 20-55 m)
  p=mk(1,0,true);const sx=p.x;p.dx=0;p.dy=1;let n=0;while(!(p.vy>0&&Math.abs(p.vx)<1)&&n<600){go(p,1);n++;}
  assert.ok((p.x-sx)/UNITS_PER_METRE<20,species+' sprint turn drift');
  // releasing the keys stops within a second
  p=mk(1,0);p.dx=0;go(p,60);assert.equal(Math.hypot(p.vx,p.vy),0,species+' stops');
  // the heavier the animal, the slower the pivot
  assert.ok(g.turnRate>=6);
 }
 assert.ok(ANIMALS.impala.gait.grip>ANIMALS.zebra.gait.grip&&ANIMALS.impala.gait.turnRate>ANIMALS.lion.gait.turnRate);
});
