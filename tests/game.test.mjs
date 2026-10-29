import test from 'node:test';
import assert from 'node:assert/strict';
import {HUNT_REACH_MULTIPLIER,move,UNITS_PER_METRE,spawnPoint,W,H,ANIMALS,SPECIES,WILDLIFE,newPlayer,newRoom,start,respawn,die,tick,props,interact,savannaEvent,useAbility,perch,hidden,publicRoom,makeFoods,solid,solidRadius,KICK_RANGE,TREE_REACH,climbPose,canClimb,BODY,resolveStrike,STRIKE_WINDUP,lightAt as lightAtSync} from '../lib/game.ts';
/** press E and let the lunge land */
const hunt=(p,room,t)=>{interact(p,room,t);if(p.strikeId&&p.strikeAt)resolveStrike(p,room,t+STRIKE_WINDUP);};
import {tree as acaciaTree,limbPoint} from '../lib/acacia.ts';
const NOW=1800000000000;
// an open patch of plain: no thicket (hiding), boulder, tree or water nearby
const OPEN=(()=>{for(let y=300;y<H-300;y+=50)for(let x=300;x<W-300;x+=50)if(props(417).every(p=>Math.hypot(p.x-x,p.y-y)>(p.kind==='water'?p.size+150:p.kind==='tallgrass'?p.size*100+150:150)))return{x,y};})();
function fixture(species='lion'){
 const player=newPlayer('test-host','Test Host',NOW,false,species);player.token='test-only-token';player.x=OPEN.x;player.y=OPEN.y;player.protectedUntil=0;
 const room=newRoom('TESTAB',player,NOW);Object.assign(room,{phase:'playing',started:NOW,ends:NOW+300000,foods:[]});return{room,player};
}
const near=(player,species,dx=10)=>{const q=newPlayer('q-'+species,species,NOW,true,species);Object.assign(q,{x:player.x+dx,y:player.y,protectedUntil:0,health:1});return q;}; // Finishing-hit fixtures; healthy-prey cases are in safari-updates.test.mjs.
test('six savanna species, five-minute rounds, two humans and 60 wildlife slots',()=>{
 assert.deepEqual([...SPECIES],['lion','leopard','hyena','zebra','impala','warthog']);
 const {room,player}=fixture();room.players.push(newPlayer('friend','Friend',NOW,false,'zebra'));const previous=room.players.map(p=>p.species);start(room,NOW);
 assert.equal(room.ends-room.started,300000);assert.equal(room.players.length,2+WILDLIFE.length);assert.equal(room.players[0].token,'test-only-token');
 room.players.slice(0,2).forEach((p,i)=>assert.notEqual(p.species,previous[i]));
 assert.equal(publicRoom(room,NOW).players.some(p=>'token' in p),false);
 const grazers=WILDLIFE.filter(s=>!ANIMALS[s].prey.length).length;assert.ok(grazers>WILDLIFE.length*.65,'mostly grazers');
});
test('predators only hunt prey their size can take',()=>{
 assert.ok(!ANIMALS.leopard.prey.includes('zebra'));assert.ok(ANIMALS.lion.prey.includes('zebra'));
 for(const s of SPECIES)assert.ok(!ANIMALS[s].prey.includes('lion'));
 const {room,player}=fixture('leopard');const zebra=near(player,'zebra');room.players.push(zebra);interact(player,room,NOW);assert.equal(player.hunts,0);assert.equal(zebra.deadUntil,0);
 const impala=near(player,'impala',12);room.players.push(impala);hunt(player,room,NOW+1000);assert.equal(player.hunts,1);assert.ok(impala.deadUntil);
});
test('zebras: a lone hyena cannot take one, a clan of three can; wild lions and clans favour zebra',()=>{
 const{room,player}=fixture('hyena');const z=near(player,'zebra',14);z.heading=Math.PI;room.players.push(z);
 hunt(player,room,NOW);assert.equal(player.hunts,0,'one hyena is not enough');assert.match(player.message,/two more hyenas/);
 const mate=(i,dy)=>{const h=newPlayer('clan'+i,'H',NOW,true,'hyena');Object.assign(h,{x:player.x-10,y:player.y+dy,protectedUntil:0});room.players.push(h);return h;};
 mate(1,40);hunt(player,room,NOW+1000);assert.equal(player.hunts,0,'two is not a clan');
 mate(2,-40);hunt(player,room,NOW+2000);assert.equal(player.hunts,1,'three hyenas bring the zebra down');assert.ok(z.deadUntil);
 // wild lion with an impala and a zebra in view, the zebra a bit further off: it picks the zebra
 {const{room,player:o}=fixture('zebra');room.players=[];o.x=20;o.y=20;room.players.push(o);start(room,NOW);room.players=[room.players.find(p=>!p.bot),room.players.find(p=>p.bot&&p.species==='lion')];room.players[0].species='zebra';
  const lion=room.players.find(p=>p.bot&&p.species==='lion');Object.assign(lion,{x:OPEN.x,y:OPEN.y,hunger:50,mood:'patrol',targetId:''});
  const imp=newPlayer('imp','I',NOW,true,'impala'),zeb=newPlayer('zeb','Z',NOW,true,'zebra');Object.assign(imp,{x:OPEN.x+60,y:OPEN.y,vx:12,protectedUntil:0});Object.assign(zeb,{x:OPEN.x,y:OPEN.y+90,vx:12,protectedUntil:0});
  room.players.push(imp,zeb);for(const p of room.players)p.lastSeen=Infinity;tick(room,NOW+100);assert.equal(lion.targetId,'zeb');}
 // a warthog is only worth a lion's chase once the lion is properly hungry
 for(const [hunger,want] of [[85,''],[60,'hog']]){const{room,player:o}=fixture('zebra');room.players=[];o.x=20;o.y=20;room.players.push(o);start(room,NOW);room.players=[room.players.find(p=>!p.bot),room.players.find(p=>p.bot&&p.species==='lion')];room.players[0].species='zebra';
  const lion=room.players.find(p=>p.bot&&p.species==='lion');Object.assign(lion,{x:OPEN.x,y:OPEN.y,hunger,mood:'patrol',targetId:''});
  const hog=newPlayer('hog','W',NOW,true,'warthog');Object.assign(hog,{x:OPEN.x+50,y:OPEN.y,vx:10,protectedUntil:0});room.players.push(hog);for(const p of room.players)p.lastSeen=Infinity;tick(room,NOW+100);assert.equal(lion.targetId,want,'hunger '+hunger);}
});
test('a kill leaves a carcass that scavengers can eat',()=>{
 const {room,player}=fixture('lion');const prey=near(player,'warthog');room.players.push(prey);hunt(player,room,NOW);
 const carcass=room.foods.find(f=>f.kind==='carrion');assert.ok(carcass);
 const hyena=newPlayer('h','H',NOW,true,'hyena');Object.assign(hyena,{x:carcass.x,y:carcass.y,protectedUntil:0,hunger:50});room.players.push(hyena);
 interact(hyena,room,NOW+1000);assert.equal(hyena.scavenged,0,'not ready while the hunter feeds');
 interact(hyena,room,NOW+8000);assert.equal(hyena.scavenged,1);assert.equal(hyena.score,5+2,"golden graze bonus plus the hyena scavenging bonus");
});
test('phase bonuses are real scoring',()=>{
 for(const [elapsed,points]of [[0,5],[100000,3],[200000,3]]){const{room,player}=fixture('zebra');player.hunger=50;room.foods=[{id:1,x:player.x,y:player.y,kind:'grass',ready:0}];interact(player,room,NOW+elapsed);assert.equal(player.score,points);}
 for(const [elapsed,points]of [[0,10],[100000,15],[200000,10]]){const{room,player}=fixture('lion');const victim=near(player,'impala');room.players.push(victim);hunt(player,room,NOW+elapsed);assert.equal(player.score,points);}
 // a 5-minute round sees each phase once; 10-minute and unlimited rounds keep cycling them
 assert.deepEqual([0,100000,200000,300000,400000,599000].map(t=>savannaEvent({started:NOW},NOW+t).kind),['forage','hunt','escape','forage','hunt','escape']);
});
// ---- the outside review's exploits, reproduced and kept fixed
test('water: drinking at full thirst scores nothing, never stands in for food, and thirst runs down on its own',()=>{
 const water=props(417).find(p=>p.kind==='water');
 const{room,player}=fixture('zebra');Object.assign(player,{x:water.x+water.size+5,y:water.y,thirst:100,hunger:50});
 for(let i=0;i<40;i++)interact(player,room,NOW+i*1000);
 assert.equal(player.score,0,'forty presses at a full drink: no points');
 // the same for food: a full animal standing on grass can't graze for points
 {const{room:r2,player:z}=fixture('zebra');r2.foods=[{id:1,x:z.x,y:z.y,kind:'grass',ready:0}];z.hunger=95;for(let i=0;i<30;i++)interact(z,r2,NOW+i*20000);assert.equal(z.score,0);assert.equal(z.food,0);z.hunger=50;interact(z,r2,NOW+700000);assert.equal(z.food,1);}assert.equal(player.drinks,0);assert.equal(player.hunger,50,'water is not food');
 player.thirst=30;for(let i=40;i<80;i++)interact(player,room,NOW+i*1000);
 assert.equal(player.drinks,1,'one real drink');assert.equal(player.score,2);assert.equal(player.thirst,100);assert.equal(player.hunger,50);
 // thirst falls in the round, and an animal with none left burns its food twice as fast
 const a=fixture('impala'),b=fixture('impala');Object.assign(a.player,{thirst:60});Object.assign(b.player,{thirst:0});
 for(let i=1;i<=100;i++){for(const f of [a,b]){Object.assign(f.player,{protectedUntil:Infinity,lastSeen:NOW+i*100});tick(f.room,NOW+i*100);}}
 assert.ok(Math.abs(a.player.thirst-(60-1000/240))<.01,'thirst falls about 4 in 10 s: '+a.player.thirst);
 assert.ok(Math.abs((100-b.player.hunger)-2*(100-a.player.hunger))<.2,'parched hunger drain is double');
});
test('restarting does not re-pay a task: each species task pays once a round, and a new animal is not thirsty yet',()=>{
 const water=props(417).find(p=>p.kind==='water'),{room,player}=fixture('zebra');
 const atWater=()=>Object.assign(player,{x:water.x+water.size+5,y:water.y,thirst:30,lastSeen:Infinity,protectedUntil:Infinity});
 let t=NOW;atWater();interact(player,room,t);tick(room,t+=100);const first=player.score;assert.equal(first,2+25,'drink and the drink task');
 for(let life=0;life<4;life++){die(player,room,t,'started a new life.');player.bag=['zebra'];respawn(player,t+=2600,room);room.tick=t;assert.equal(player.species,'zebra');
  assert.ok(player.thirst>=70,'a fresh animal has drunk recently: '+player.thirst);atWater();interact(player,room,t+=700);tick(room,t+=100);}
 assert.equal(player.score,first+4*2,'only the drinks themselves score again');assert.ok(player.claimed[1],'the HUD shows the task as done');
 // a voluntary new life is a real death: a longer wait, and no free refill of food or water
 Object.assign(player,{hunger:30,thirst:40});die(player,room,t,'started a new life.');assert.ok(player.deadUntil-t>=6000);respawn(player,player.deadUntil,room);
 assert.equal(player.hunger,30);assert.equal(player.thirst,40);assert.equal(player.lives.at(-1).cause,'started a new life.');
 start(room,t+=10000);assert.deepEqual(player.done,[],'a new round starts fresh');assert.deepEqual(player.lives,[]);
});
test('staying alive pays more the longer a life lasts, so throwing lives away never pays',()=>{
 const run=(seconds,restartEvery)=>{const{room,player}=fixture('zebra');room.foods=[];let t=NOW,born=NOW;
  for(let i=1;i<=seconds*10;i++){t=NOW+i*100;Object.assign(player,{lastSeen:t,inputAt:t,hunger:100,thirst:100,protectedUntil:Infinity});
   if(restartEvery&&!player.deadUntil&&t-born>=restartEvery*1000){die(player,room,t,'started a new life.');player.bag=['zebra'];}
   const was=player.deadUntil;tick(room,t);if(was&&!player.deadUntil)born=t;}
  return player.score;};
 assert.equal(run(181),10+20+30,'three minutes alive: 10 + 20 + 30');
 assert.ok(run(181,61)<run(181),'restarting after each paid minute earns less than living on: '+run(181,61));
});
test('catches: front only, nothing in between, a windup the prey can answer, one catch per press',()=>{
 // prey behind the hunter
 {const{room,player}=fixture('lion');const q=near(player,'impala',-12);room.players.push(q);hunt(player,room,NOW);assert.equal(player.hunts,0,'no catching what is behind you');assert.match(player.message,/Missed/);}
 // facing it works, and only the press commits: the kill lands STRIKE_WINDUP later
 {const{room,player}=fixture('lion');const q=near(player,'impala',12);room.players.push(q);interact(player,room,NOW);assert.equal(player.hunts,0);assert.equal(q.deadUntil,0,'nothing happens on the press itself');
  interact(player,room,NOW+10);interact(player,room,NOW+700);resolveStrike(player,room,NOW+STRIKE_WINDUP);assert.equal(player.hunts,1);assert.equal(player.score,10,'mashing E is still one catch');
  hunt(player,room,NOW+2000);assert.equal(player.hunts,1,'no second kill of the same body');}
 // across an acacia trunk
 {const{room,player}=fixture('lion'),tree=props(417).find(p=>p.kind==='tree');Object.assign(player,{x:tree.x-12,y:tree.y,heading:0});const q=near(player,'impala',24);room.players.push(q);
  hunt(player,room,NOW);assert.equal(player.hunts,0,'no catch through wood');}
 // the prey leaps during the windup
 {const{room,player}=fixture('lion');const q=near(player,'impala',15);room.players.push(q);interact(player,room,NOW);assert.ok(player.strikeId);useAbility(q,room,NOW+100);resolveStrike(player,room,NOW+STRIKE_WINDUP);assert.equal(player.hunts,0,'an impala that leaps in time gets away');assert.ok(q.threatAt>0);}
 // a zebra kicks during the windup (the lion is behind it), and a stunned lion can't start another
 {const{room,player}=fixture('lion');const z=near(player,'zebra',14);z.heading=0;room.players.push(z);interact(player,room,NOW);assert.ok(player.strikeId);useAbility(z,room,NOW+100);assert.ok(player.stunUntil>NOW);
  resolveStrike(player,room,NOW+STRIKE_WINDUP);assert.equal(player.hunts,0);hunt(player,room,NOW+700);assert.equal(player.hunts,0,'stunned');}
 // the prey runs out of reach before the lunge lands
 {const{room,player}=fixture('lion');const q=near(player,'impala',20);room.players.push(q);interact(player,room,NOW);q.x+=40;resolveStrike(player,room,NOW+STRIKE_WINDUP);assert.equal(player.hunts,0);assert.equal(q.deadUntil,0);}
 // the hunter dies or starts a new life mid-lunge
 {const{room,player}=fixture('lion');const q=near(player,'impala',12);room.players.push(q);interact(player,room,NOW);die(player,room,NOW+50,'test');respawn(player,NOW+100,room);
  Object.assign(player,{species:'lion',x:q.x-12,y:q.y,protectedUntil:0});for(let i=1;i<=5;i++)tick(room,NOW+100+i*100);assert.equal(player.hunts,0,'a strike never carries into a new life');assert.equal(q.deadUntil,0);}
 // resolution happens in the room's own tick, so the server decides
 {const{room,player}=fixture('lion');const q=near(player,'impala',12);q.bot=false;room.players.push(q);interact(player,room,NOW);for(let i=1;i<=4;i++){q.inputAt=player.inputAt=NOW+i*100;tick(room,NOW+i*100);}assert.equal(player.hunts,1);assert.ok(q.deadUntil);}
 // a leopard's leap misses if the prey has moved by the time it lands
 {const{room,player}=fixture('leopard'),ps=props(417),tree=ps.find(p=>p.kind==='tree');Object.assign(player,{x:tree.x+TREE_REACH-5,y:tree.y});let t=NOW;perch(player,room,t);for(let i=0;i<120;i++){move(player,.05,ps,t);t+=50;}assert.equal(player.climb,'limb');
  const q=near(player,'impala',30);room.players.push(q);interact(player,room,t);assert.equal(player.climb,'drop');q.x+=120;for(let i=0;i<40&&player.climb;i++){move(player,.05,ps,t);t+=50;}resolveStrike(player,room,player.strikeAt||t);assert.equal(player.hunts,0);assert.equal(q.deadUntil,0);}
});
test('zebra kick stuns a lion, impala leap and warthog burrow escape a catch',()=>{
 {const{room,player}=fixture('zebra');player.heading=Math.PI;const lion=near(player,'lion',KICK_RANGE-10);room.players.push(lion);useAbility(player,room,NOW);assert.ok(lion.stunUntil>NOW);hunt(lion,room,NOW+100);assert.equal(lion.hunts,0);}
 {const{room,player}=fixture('impala');const lion=near(player,'lion',15);room.players.push(lion);useAbility(player,room,NOW);hunt(lion,room,NOW+200);assert.equal(lion.hunts,0);}
 {const{room,player}=fixture('warthog');const burrow=props(417).find(p=>p.kind==='burrow');Object.assign(player,{x:burrow.x+20,y:burrow.y});useAbility(player,room,NOW);assert.ok(Math.hypot(player.x-burrow.x,player.y-burrow.y)<=5.01,'backed into the hole');assert.ok(hidden(player,room,NOW+1000));}
});
test('leopards climb a trunk, walk out on a bough, turn round, ambush and climb down head first',()=>{
 const{room,player}=fixture('leopard'),ps=props(417),tree=ps.find(p=>p.kind==='tree');Object.assign(player,{x:tree.x+TREE_REACH-5,y:tree.y});
 const T=acaciaTree(ps,tree),poses=[];let t=NOW;const run=(sec,dx=0,dy=0)=>{for(let i=0;i<sec*20;i++){player.dx=dx;player.dy=dy;move(player,.05,ps,t);t+=50;const q=climbPose(ps,player);if(q)poses.push(q);}};
 perch(player,room,t);assert.equal(player.climb,'approach');assert.ok(!hidden(player,room,t),'climbing is not hiding');
 run(6);assert.equal(player.climb,'limb','reaches the resting bough');
 const lift=T.limbs[player.limb].start/UNITS_PER_METRE;assert.ok(lift>1.5&&lift<4.5,'the bough is '+lift.toFixed(1)+' m up');
 // the body stands on top of the bark: its origin sits one bark radius above the limb's centreline
 const onBark=()=>{const L=limbPoint(T,player.limb,player.along),q=climbPose(ps,player);return Math.abs(Math.hypot(q.x-L.x,q.y-L.y,q.h-L.h)-L.r);};
 assert.ok(onBark()<.05);assert.ok(hidden(player,room,t),'a leopard lying up in the canopy is hidden');
 const start=player.along,out=T.limbs[player.limb];run(1.5,Math.cos(out.angle),Math.sin(out.angle));assert.ok(player.along>start+5,'walks out along the bough');assert.ok(onBark()<.05);
 // reversing: it first pivots in place, then walks back
 const before=player.along;run(.2,-Math.cos(out.angle),-Math.sin(out.angle));assert.equal(player.limbDir,-1);assert.ok(Math.abs(player.along-before)<.01,'pivots before walking back');
 run(1.5,-Math.cos(out.angle),-Math.sin(out.angle));assert.ok(player.along<before);
 // no frame jumps: every step of the climb moves the body less than a sprinting leopard would
 for(let i=1;i<poses.length;i++){const a=poses[i-1],b=poses[i];assert.ok(Math.hypot(b.x-a.x,b.y-a.y,b.h-a.h)<16.5*UNITS_PER_METRE*.05,'continuous at step '+i);}
 // ambush: drops onto prey below, then lands
 const impala=near(player,'impala',30);room.players.push(impala);interact(player,room,t);assert.equal(player.climb,'drop');assert.equal(player.hunts,0,'the leap is checked when it lands, not when it starts');
 run(2);assert.equal(player.climb,'');assert.equal(player.perched,false);assert.ok(player.strikeAt>0,'landing arms the strike');resolveStrike(player,room,player.strikeAt);assert.equal(player.hunts,1);assert.equal(player.score,13);
 // and the long way down: back to the trunk, head first, a jump for the last stretch
 Object.assign(player,{x:tree.x+TREE_REACH-5,y:tree.y});perch(player,room,t);run(6);assert.equal(player.climb,'limb');perch(player,room,t);
 const seen=new Set();for(let i=0;i<200&&player.climb;i++){run(.05);seen.add(player.climb);if(player.climb==='trunk')assert.ok(climbPose(ps,player).pitch<-1,'head first');}
 assert.deepEqual([...seen].filter(s=>s),['limb','mount','trunk','drop']);assert.equal(player.perched,false);assert.ok(Math.hypot(player.x-tree.x,player.y-tree.y)>solidRadius(tree));
});
test('lions only scramble into low, thick boughs; grazers and hyenas never climb',()=>{
 const ps=props(417),trees=ps.filter(p=>p.kind==='tree'),low=trees.find(t=>canClimb('lion',ps,t)),high=trees.find(t=>!canClimb('lion',ps,t));
 assert.ok(low&&high,'the plains have both kinds of tree');
 for(const [t,ok] of [[low,true],[high,false]]){
  const{room,player}=fixture('lion');Object.assign(player,{x:t.x+TREE_REACH-5,y:t.y});let now=NOW;perch(player,room,now);
  const seen=new Set();for(let i=0;i<240;i++){move(player,.05,ps,now);now+=50;seen.add(player.climb);}
  if(ok){assert.equal(player.climb,'limb');const T=acaciaTree(ps,t),L=limbPoint(T,player.limb,player.along);assert.ok(T.limbs[player.limb].rest);
   // it can't go out onto thin wood
   for(let i=0;i<200;i++){player.dx=Math.cos(T.limbs[player.limb].angle);player.dy=Math.sin(T.limbs[player.limb].angle);move(player,.05,ps,now);now+=50;}
   assert.ok(limbPoint(T,player.limb,player.along).r>=.085*UNITS_PER_METRE-.01,'stays where the wood takes 190 kg');
   perch(player,room,now);assert.equal(player.climb,'drop');for(let i=0;i<60;i++){move(player,.05,ps,now);now+=50;}assert.equal(player.climb,'');}
  else{assert.ok(seen.has('slip'));assert.equal(player.climb,'');assert.equal(player.perched,false);assert.match(player.message,/Too high/);}
 }
 for(const s of ['hyena','zebra','impala','warthog']){const{room,player}=fixture(s);Object.assign(player,{x:low.x+TREE_REACH-5,y:low.y});perch(player,room,NOW);assert.ok(!player.climb&&!player.perched,s+' stays on the ground');}
});
test('bodies, not points: no animal pushes its head or flank into a trunk or boulder',()=>{
 const ps=props(417);
 for(const kind of ['tree','rock'])for(const s of SPECIES){const t=ps.find(p=>p.kind===kind&&p.size<1.2);for(let k=0;k<8;k++){
  const a=k/8*Math.PI*2,{room,player}=fixture(s);Object.assign(player,{x:t.x+Math.cos(a)*(solidRadius(t)+60),y:t.y+Math.sin(a)*(solidRadius(t)+60)});let now=NOW;
  for(let i=0;i<80;i++){player.dx=-Math.cos(a);player.dy=-Math.sin(a);move(player,.05,ps,now);now+=50;
   const [front,rear,half]=BODY[s],h=player.heading,nose={x:player.x+Math.cos(h)*front*10,y:player.y+Math.sin(h)*front*10};
   assert.ok(Math.hypot(nose.x-t.x,nose.y-t.y)>=solidRadius(t)+half*10-1,`${s} nose into a ${kind}`);}
 }}
});
test('drinking at a watering hole counts for the drink task',()=>{
 const{room,player}=fixture('lion');const water=props(417).find(p=>p.kind==='water');Object.assign(player,{x:water.x+water.size+10,y:water.y,thirst:30});interact(player,room,NOW);assert.equal(player.drinks,1);tick(room,NOW+200);assert.ok(player.claimed[1]);
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
  const{room,player}=fixture(hunter);const q=near(player,prey,15);room.players.push(q);hunt(player,room,NOW);
  // (a hyena alone can't take a zebra: that needs the clan, tested separately)
  assert.equal(!!q.deadUntil,ANIMALS[hunter].prey.includes(prey)&&!(hunter==='hyena'&&prey==='zebra'),hunter+' vs '+prey);
  if(hunter==='hyena'&&prey==='zebra')continue;
  if(!ANIMALS[hunter].prey.includes(prey))continue;
  const{room:r2,player:h2}=fixture(hunter);const shielded=near(h2,prey,15);shielded.protectedUntil=NOW+4000;r2.players.push(shielded);hunt(h2,r2,NOW);assert.equal(shielded.deadUntil,0,'spawn protection '+hunter+' vs '+prey);
  const{room:r3,player:h3}=fixture(hunter);const away=near(h3,prey,ANIMALS[hunter].catchRange*HUNT_REACH_MULTIPLIER+5);r3.players.push(away);hunt(h3,r3,NOW);assert.equal(away.deadUntil,0,'out of reach '+hunter+' vs '+prey);
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
 // (a warthog family may share one burrow: one underground is not piled up with one at the mouth)
 const end=NOW+1800*100;for(const p of a.room.players)for(const q of a.room.players)if(p!==q&&!p.deadUntil&&!q.deadUntil&&!(hidden(p,a.room,end)&&hidden(q,a.room,end))&&![p,q].some(o=>o.species==='warthog'&&o.abilityUntil>end))assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>2,'piled up: '+p.id+' '+q.id);
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
test('species are dealt fairly: every animal once in each run of six lives, never the same twice in a row',()=>{
 const {room,player}=fixture();start(room,NOW);const seen=[player.species];
 for(let i=0;i<59;i++){die(player,room,NOW,'test');respawn(player,NOW+2600,room);seen.push(player.species);}
 for(let i=1;i<seen.length;i++)assert.notEqual(seen[i],seen[i-1]);
 for(const s of SPECIES){const n=seen.filter(x=>x===s).length;assert.ok(n>=9&&n<=11,s+' came up '+n+' times in 60 lives');}
 assert.equal(publicRoom(room,NOW).players.some(p=>'bag' in p),false,'upcoming animals stay secret');
});
// ---- day and night
test('day and night: a round opens at 10:00, a day passes every 5 minutes, and the sun takes its real path at 2.3° S',async()=>{
 const {clockHour,sunAt,lightAt,DAY_MS}=await import('../lib/game.ts');
 assert.equal(DAY_MS,300000);
 assert.deepEqual([0,100000,200000,300000].map(t=>Math.round(clockHour({started:NOW},NOW+t)*100)/100),[10,18,2,10],'the bonus phases fall at 10:00, 18:00 and 02:00');
 // 10:00 is the late-morning sun the world was lit by before: altitude 51°, azimuth 47° east of north
 const s=sunAt(10);assert.ok(Math.abs(Math.asin(s.up)*180/Math.PI-51)<1);assert.ok(Math.abs(Math.atan2(s.east,s.north)*180/Math.PI-47)<1.5);
 // near the equator the sun rises close to 06:00 and sets close to 18:00 (about 06:04 and 17:56 in late June)
 const rise=[...Array(2400).keys()].map(i=>i/100).find(h=>h>3&&sunAt(h).up>0),set=[...Array(2400).keys()].map(i=>i/100).find(h=>h>12&&sunAt(h).up<0);
 assert.ok(Math.abs(rise-6.07)<.05&&Math.abs(set-17.93)<.05,`sunrise ${rise}, sunset ${set}`);
 const room={started:NOW,seed:417,round:1};
 assert.equal(lightAt(room,NOW).day,1);assert.equal(lightAt(room,NOW+150000).day,0,"22:00 is dark");
});
test('day and night: in the dark, prey notice a lion much later; a lion still sees prey nearly as far as by day',()=>{
 const{room,player}=fixture('impala');room.round=1;
 const lion=newPlayer('wild-lion','Lion',NOW,true,'lion');Object.assign(lion,{x:player.x+110,y:player.y,vx:50,vy:0,dx:1,dy:0,protectedUntil:0});room.players.push(lion);
 const LATE=NOW+150000; // 22:00
 // a walking lion 11 m off in the open: seen by day, missed on a dark night
 assert.equal(sense(player,lion,room,NOW)?.how,'sight');
 const night=[...Array(40).keys()].map(r=>({...room,round:r})).find(r=>{const{moonlight}=lightAtSync(r,LATE);return moonlight<.1;});
 assert.ok(night,'some round has a dark midnight');
 assert.notEqual(sense(player,lion,night,LATE)?.how,'sight');
 // the lion keeps most of its sight: it still sees the impala walking at the same distance
 Object.assign(player,{vx:40,vy:0,dx:1,dy:0});
 assert.equal(sense(lion,player,night,LATE)?.how,'sight');
});
