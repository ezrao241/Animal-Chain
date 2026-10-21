import test from 'node:test';
import assert from 'node:assert/strict';
import {W,H,ANIMALS,SPECIES,WILDLIFE,newPlayer,newRoom,start,respawn,die,tick,props,interact,savannaEvent,useAbility,perch,hidden,publicRoom,makeFoods,solid,solidRadius,KICK_RANGE,TREE_REACH} from '../lib/game.ts';
const NOW=1800000000000;
function fixture(species='lion'){
 const player=newPlayer('test-host','Test Host',NOW,false,species);player.token='test-only-token';player.x=2000;player.y=1400;player.protectedUntil=0;
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
