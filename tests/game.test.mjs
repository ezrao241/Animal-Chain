import test from 'node:test';
import assert from 'node:assert/strict';
import {W,H,ANIMALS,SPECIES,WILDLIFE,newPlayer,newRoom,start,respawn,die,tick,move,props,interact,forestEvent,useAbility,perch,hidden,publicRoom,cameraInput,TRUNK_RADIUS,TREE_REACH,REAL_SPEED} from '../lib/game.ts';
const NOW=1800000000000;
function fixture(species='fox'){
 const player=newPlayer('test-host','Test Host',NOW,false,species);player.token='test-only-token';player.x=1000;player.y=700;player.protectedUntil=0;
 const room=newRoom('TESTAB',player,NOW);Object.assign(room,{phase:'playing',started:NOW,ends:NOW+300000,foods:[]});return{room,player};
}
test('five-minute rounds, two humans, and 60 ecological slots',()=>{
 const {room,player}=fixture();room.players.push(newPlayer('friend','Friend',NOW,false,'mouse'));const previous=room.players.map(p=>p.species);start(room,NOW);
 assert.equal(room.ends-room.started,300000);assert.equal(room.players.length,2+WILDLIFE.length);assert.equal(room.players[0].token,'test-only-token');
 room.players.slice(0,2).forEach((p,i)=>assert.notEqual(p.species,previous[i]));assert.deepEqual(room.players.filter(p=>p.bot).map(p=>p.species),WILDLIFE);
 assert.equal(publicRoom(room,NOW).players.some(p=>'token' in p),false);
});
test('human reincarnation changes species but keeps round score',()=>{
 const {room,player}=fixture();player.score=125;die(player,room,NOW,'test');const previous=player.species;respawn(player,NOW+2600);
 assert.notEqual(player.species,previous);assert.equal(player.score,125);assert.equal(player.deaths,1);assert.equal(player.hunger,100);assert.equal(player.hunts,0);
});
test('wildlife always respawns into the same ecological slot',()=>{
 WILDLIFE.forEach((species,i)=>{const p=newPlayer('wild-'+i,'wild',NOW,true,species);for(let j=0;j<30;j++){respawn(p,NOW+j*3000);assert.equal(p.species,species);}});
});
test('phase bonuses are real scoring, not just display text',()=>{
 for(const [elapsed,points]of [[0,5],[100000,3],[200000,3]]){const{room,player}=fixture('rabbit');room.foods=[{id:1,x:player.x,y:player.y,kind:'grass',ready:0}];interact(player,room,NOW+elapsed);assert.equal(player.score,points);}
 for(const [elapsed,points]of [[0,10],[100000,15],[200000,10]]){const{room,player}=fixture('fox');const victim=newPlayer('prey','Prey',NOW,true,'rabbit');Object.assign(victim,{x:player.x+10,y:player.y,protectedUntil:0});room.players.push(victim);interact(player,room,NOW+elapsed);assert.equal(player.score,points);assert.ok(victim.deadUntil);}
 assert.deepEqual([0,100000,200000,300000].map(t=>forestEvent({started:NOW},NOW+t).kind),['forage','hunt','escape','escape']);
});
test('diets, concealment and spawn protection are enforced',()=>{
 const{room,player}=fixture('snake');const rabbit=newPlayer('rabbit','Rabbit',NOW,true,'rabbit');Object.assign(rabbit,{x:player.x+5,y:player.y,protectedUntil:0});room.players.push(rabbit);interact(player,room,NOW);assert.equal(player.hunts,0);
 rabbit.species='mouse';rabbit.protectedUntil=NOW+4000;interact(player,room,NOW+1000);assert.equal(player.hunts,0);
 rabbit.protectedUntil=0;rabbit.abilityUntil=NOW+10000;interact(player,room,NOW+2000);assert.equal(player.hunts,0);
 rabbit.abilityUntil=0;interact(player,room,NOW+3000);assert.equal(player.hunts,1);
});
test('sprint is faster, diagonal speed is capped, trees resolve collisions',()=>{
 const a=newPlayer('a','a',NOW,false,'fox'),b={...a},c={...a};Object.assign(a,{x:1000,y:700,dx:1,dy:0});Object.assign(b,a,{sprint:true});Object.assign(c,a,{dx:1,dy:1});
 for(let i=0;i<10;i++){move(a,.1,[],NOW);move(b,.1,[],NOW);move(c,.1,[],NOW);}assert.ok(b.x-a.x>65*REAL_SPEED);assert.ok(Math.abs(Math.hypot(c.x-1000,c.y-700)-(a.x-1000))<.01);
 a.x=1000-TRUNK_RADIUS+1;a.y=700;a.dx=1;a.dy=0;move(a,.1,[{x:1000,y:700,size:100,kind:'tree'}],NOW);assert.ok(Math.hypot(a.x-1000,a.y-700)>=TRUNK_RADIUS-.01);
});
test('holding sprint while stationary does not consume stamina',()=>{
 const{room,player}=fixture();player.sprint=true;tick(room,NOW+500);assert.equal(player.stamina,100);
 player.dx=1;player.stamina=1;player.inputAt=NOW+500;tick(room,NOW+600);assert.equal(player.exhausted,true);player.dx=0;
 for(let i=1;i<=20;i++){player.lastSeen=NOW+600+i*100;tick(room,player.lastSeen);}assert.equal(player.exhausted,false);assert.ok(player.stamina>=25);
});
test('owl flight and canopy hiding work; squirrel climbs against a tree',()=>{
 const{room,player}=fixture('owl');useAbility(player,room,NOW);assert.equal(player.owlMode,'flying');const trees=props(room.seed).filter(p=>p.kind==='tree'||p.kind==='pine'),tree=trees.find(p=>p.kind==='tree'&&!trees.some(q=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)<180));player.x=tree.x+TREE_REACH-10;player.y=tree.y;perch(player,room,NOW+1000);assert.equal(player.owlMode,'perched');assert.ok(player.perchHeight>100);assert.equal(hidden(player,room,NOW+1000),true);perch(player,room,NOW+2000);assert.equal(player.owlMode,'flying');
 player.species='squirrel';player.abilityReady=0;player.x=tree.x+TREE_REACH-5;useAbility(player,room,NOW+3000);assert.ok(player.abilityUntil>NOW+3000);assert.ok(Math.abs(Math.hypot(player.x-tree.x,player.y-tree.y)-(TRUNK_RADIUS+1))<.01);
});
test('camera-relative input rotates consistently',()=>{
 const north=cameraInput(0,-1,0),west=cameraInput(0,-1,Math.PI/2);assert.equal(north.dy,-1);assert.ok(Math.abs(west.dx+1)<1e-10);assert.ok(Math.abs(west.dy)<1e-10);
});
test('full-round simulation keeps all species populated and ends on time',()=>{
 const {room,player}=fixture();room.players.push(newPlayer('friend','Friend',NOW,false,'mouse'));start(room,NOW);let minimumAvailableMice=100;const counts={};
 for(let i=1;i<=3000;i++){const t=NOW+i*100;for(const p of room.players)if(!p.bot)p.lastSeen=t;tick(room,t);const bots=room.players.filter(p=>p.bot);assert.deepEqual(bots.map(p=>p.species),WILDLIFE);assert.ok(bots.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=W&&p.y>=0&&p.y<=H));minimumAvailableMice=Math.min(minimumAvailableMice,bots.filter(p=>p.species==='mouse'&&!p.deadUntil).length);}
 for(const s of SPECIES)counts[s]=room.players.filter(p=>p.bot&&p.species===s).length;
 assert.equal(room.phase,'finished');assert.ok(minimumAvailableMice>0);assert.ok(room.players.every(p=>p.vx===0&&p.vy===0));console.log('Full round:',JSON.stringify({counts,minimumAvailableMice,humanScores:room.players.filter(p=>!p.bot).map(p=>p.score)}));
});
