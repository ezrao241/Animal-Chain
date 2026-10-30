import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlayer,newRoom,start,tick,props,interact,resolveStrike,useAbility,STRIKE_WINDUP,STALK_BADGE_RANGE,sense,stalkedClose,H,W,SPECIES} from '../lib/game.ts';
import {roomRequest,viewFor} from '../lib/net.ts';
import {BADGES,COATS,RARE,SKINS,SKIN_BASE,coatUnlocked,coatCode,coatOf,unlockedKeys} from '../lib/rewards.ts';
import {SPECIES_FACTS} from '../lib/species-facts.ts';

const NOW=1800000000000;
const OPEN=(()=>{for(let y=300;y<H-300;y+=50)for(let x=300;x<W-300;x+=50)if(props(417).every(p=>Math.hypot(p.x-x,p.y-y)>(p.kind==='water'?p.size+150:p.kind==='tallgrass'?p.size*100+150:150)))return{x,y};})();
function fixture(species){
 const me=newPlayer('me','Me',NOW,false,species);Object.assign(me,{x:OPEN.x,y:OPEN.y,protectedUntil:0,token:'t'});
 const room=newRoom('REWARD',me,NOW);Object.assign(room,{phase:'playing',started:NOW,ends:NOW+300000,foods:[]});return{room,me};
}
const wild=(room,species,x,y,extra={})=>{const q=newPlayer('wild-'+species+room.players.length,species,NOW,true,species);Object.assign(q,{x,y,protectedUntil:0,lastSeen:Infinity,mood:'graze',moodUntil:NOW+1e6,thinkAt:NOW+1e6},extra);room.players.push(q);return q;};

test('unseen at 10 m: earned exactly when the prey can\'t sense the predator, within 10 m, as a predator',()=>{
 // a grazing impala 8 m away: with its head down it misses a still lion (the same sense() the wildlife uses)
 {const{room,me}=fixture('lion');me.lastSeen=me.inputAt=Infinity;const q=wild(room,'impala',me.x+80,me.y,{heading:0});
  // standing still while it grazes close is not a stalk; creeping towards it slowly (0.6 m/s) unnoticed is
  let t=NOW;while(sense(q,me,room,t))t+=50;const ps=props(417);
  stalkedClose(me,room,ps,t);assert.ok(!me.badges?.includes('stalk10'),'standing still');
  me.vx=6;assert.equal(sense(q,me,room,t),null,'a slow creep is as hard to see as standing still');stalkedClose(me,room,ps,t);assert.ok(me.badges?.includes('stalk10'));
  me.badges=[];me.vx=-6;stalkedClose(me,room,ps,t);assert.ok(!me.badges.length,'backing away is not a stalk');
  me.vx=6;me.protectedUntil=t+1000;stalkedClose(me,room,ps,t);assert.ok(!me.badges.length,'not during spawn protection');}
 // the same impala watching (head up): it sees the lion, no badge
 {const{room,me}=fixture('lion');me.lastSeen=me.inputAt=Infinity;const q=wild(room,'impala',me.x+80,me.y,{heading:Math.PI,mood:'watch'});
  assert.ok(sense(q,me,room,NOW+100));tick(room,NOW+100);assert.ok(!me.badges?.includes('stalk10'));}
 {const{room,me}=fixture('lion');me.lastSeen=me.inputAt=Infinity;
  const q=wild(room,'impala',me.x+STALK_BADGE_RANGE+40,me.y,{heading:0});me.vx=6;let t=NOW;while(sense(q,me,room,t))t+=50;stalkedClose(me,room,props(417),t);assert.ok(!me.badges?.includes('stalk10'),'beyond 10 m does not count');}
 {const{room,me}=fixture('zebra');me.lastSeen=me.inputAt=Infinity;wild(room,'impala',me.x+80,me.y,{heading:0});tick(room,NOW+100);assert.ok(!me.badges?.length,'prey animals do not stalk');}
 // a leopard can't take a zebra, so sneaking up on one isn't stalking prey
 {const{room,me}=fixture('leopard');me.lastSeen=me.inputAt=Infinity;const q=wild(room,'zebra',me.x+80,me.y,{heading:0});
  me.vx=6;let t=NOW;while(sense(q,me,room,t))t+=50;stalkedClose(me,room,props(417),t);assert.ok(!me.badges?.length);}
});

test('a zebra kick, an impala leap and a warthog burrow under threat each earn their badge, once a round',()=>{
 {const{room,me}=fixture('zebra');me.heading=0;const lion=wild(room,'lion',me.x-25,me.y);useAbility(me,room,NOW);assert.ok(lion.stunUntil>NOW);assert.deepEqual(me.badges,['kick']);
  useAbility(me,room,NOW+20000);assert.deepEqual(me.badges,['kick'],'listed once');}
 {const{room,me}=fixture('impala');const lion=wild(room,'lion',me.x-20,me.y,{heading:0});
  interact(lion,room,NOW);assert.ok(lion.strikeId);useAbility(me,room,NOW+100);resolveStrike(lion,room,NOW+STRIKE_WINDUP);assert.equal(me.deadUntil,0);assert.deepEqual(me.badges,['bound']);}
 {const{room,me}=fixture('warthog');const burrow=props(417).find(p=>p.kind==='burrow');Object.assign(me,{x:burrow.x+20,y:burrow.y});
  useAbility(me,room,NOW);assert.ok(!me.badges?.length,'burrowing with nothing after you is no badge');
  me.abilityReady=0;me.threatAt=NOW+9000;useAbility(me,room,NOW+10000);assert.deepEqual(me.badges,['tusks']);}
});

test('a hyena clan zebra kill earns Clan hunt; eating at a fresh carcass earns Followed the vultures; bots never get badges',()=>{
 const{room,me}=fixture('hyena');me.heading=0;const z=wild(room,'zebra',me.x+14,me.y,{heading:Math.PI});
 wild(room,'hyena',me.x-10,me.y+40);wild(room,'hyena',me.x-10,me.y-40);
 interact(me,room,NOW);resolveStrike(me,room,NOW+STRIKE_WINDUP);assert.ok(z.deadUntil);assert.ok(me.badges.includes('clan'));
 const carcass=room.foods.find(f=>f.until);me.feeding=undefined;Object.assign(me,{x:carcass.x,y:carcass.y,hunger:40,interactReady:0});
 interact(me,room,carcass.ready+10);assert.ok(me.badges.includes('vultures'));
 assert.ok(room.players.filter(p=>p.bot).every(p=>!p.badges?.length));
});

test('badges reset each round, stay through a new life, and only their own player is sent them',()=>{
 const{room,me}=fixture('zebra');const other=newPlayer('other','Other',NOW,false,'lion');Object.assign(other,{token:'o',x:me.x+50,y:me.y});room.players.push(other);
 me.badges=['kick'];const mine=viewFor(room,'me',NOW).players.find(p=>p.id==='me'),theirs=viewFor(room,'other',NOW).players.find(p=>p.id==='me');
 assert.deepEqual(mine.badges,['kick']);assert.ok(!('badges' in theirs));
 me.deadUntil=NOW;tick(room,NOW+50);assert.deepEqual(me.badges,['kick'],'a new life keeps the round\'s badges');
 start(room,NOW+1000);assert.deepEqual(room.players.find(p=>p.id==='me').badges,[]);
});

test('coat choices travel with sync, everyone sees them, and bad codes are ignored',()=>{
 const{room,me}=fixture('lion');room.phase='lobby';const other=newPlayer('other','Other',NOW,false,'zebra');Object.assign(other,{token:'o',x:me.x+50,y:me.y});room.players.push(other);
 let out=roomRequest(room,{id:'me',token:'t',coats:'201010'},'sync',NOW,()=>'x');assert.equal(out.status,200);assert.equal(me.coats,'201010');
 assert.equal(viewFor(room,'other',NOW).players.find(p=>p.id==='me').coats,'201010');
 roomRequest(room,{id:'me',token:'t',coats:'999999'},'sync',NOW+10,()=>'x');assert.equal(me.coats,'201010');
 roomRequest(room,{id:'me',token:'t',coats:'345000'},'sync',NOW+15,()=>'x');assert.equal(me.coats,'345000','legendary skins travel too');
 roomRequest(room,{id:'me',token:'t',coats:'<b>'},'sync',NOW+20,()=>'x');assert.equal(me.coats,'345000');
 out=roomRequest(room,{name:'New',coats:'000200'},'join',NOW+30,()=>'new-'+Math.random());assert.equal(room.players.find(p=>p.name==='New').coats,'000200');
});

test('coat unlocks: one badge as the animal opens the first, '+RARE+' the rarer; codes only carry unlocked coats',()=>{
 const p={badges:{},earnedAs:{},coats:{lion:2,zebra:1}};
 assert.ok(coatUnlocked(p,'lion',0));assert.ok(!coatUnlocked(p,'lion',1));assert.equal(coatCode(p),'000000');
 p.earnedAs.lion=1;assert.ok(coatUnlocked(p,'lion',1));assert.ok(!coatUnlocked(p,'lion',2));assert.equal(coatCode(p),'000000','chosen coat still locked');
 p.earnedAs.lion=RARE;p.earnedAs.zebra=1;assert.equal(coatCode(p),'200100');
 assert.equal(coatOf('200100','lion'),2);assert.equal(coatOf('200100','zebra'),1);assert.equal(coatOf('900000','lion'),0);assert.equal(coatOf(undefined,'lion'),0);
});

test('every badge and coat cites a source, and every species has a natural coat',()=>{
 for(const b of BADGES){assert.match(b.url,/^https:\/\//);assert.ok(b.why&&b.source&&b.species.length);}
 for(const s of SPECIES){assert.ok(COATS[s].length>=1&&COATS[s].length<=2);for(const c of COATS[s])assert.match(c.url,/^https:\/\//);}
 assert.ok(Object.values(SPECIES_FACTS).length===6);
});

test('legendary skins: every badge once, 25 badges in all, 3 badges in one round; open to every species',()=>{
 assert.equal(SKIN_BASE,3);assert.deepEqual(SKINS.map(k=>k.id),['gilded','ember','starlight','aurora']);
 const p={badges:{},earnedAs:{},coats:{}};for(let i=0;i<3;i++)assert.ok(!coatUnlocked(p,'lion',SKIN_BASE+i));
 for(const b of BADGES)p.badges[b.id]=1;assert.ok(coatUnlocked(p,'warthog',3),'all seven badges: gilded');assert.ok(!coatUnlocked(p,'warthog',4));
 p.badges.kick=19;assert.ok(coatUnlocked(p,'zebra',4),'25 badges: ember');
 p.bestRound=3;assert.ok(coatUnlocked(p,'impala',5),'three in a round: starlight');
 p.coats={lion:3,leopard:4,hyena:5,zebra:0,impala:5,warthog:3};assert.equal(coatCode(p),'345053');
 for(const s of ['lion','impala'])for(const i of [3,4,5])assert.equal(coatOf('333333'.replace(/3/g,String(i)),s),i);
 assert.equal(coatOf('700000','lion'),0);
 assert.ok(unlockedKeys(p).includes('lion:3')&&!unlockedKeys(p).includes('lion:0'),'the usual coat is never "new"');
});

test('Field Guide Quiz: ten sourced questions; only a perfect run opens the Aurora skin, which nothing else unlocks',async()=>{
 const {QUIZ,quizFact,newAttempt}=await import('../lib/quiz.ts');
 assert.equal(QUIZ.length,10);
 for(const q of QUIZ){assert.ok(q.answer>=0&&q.answer<q.options.length);const f=quizFact(q);assert.ok(f&&f.url.startsWith('https://'),q.q);}
 const shuffled=newAttempt(()=>.3);assert.equal(shuffled.length,10);
 for(const q of shuffled){const orig=QUIZ.find(o=>o.q===q.q);assert.equal(q.options[q.answer],orig.options[orig.answer],'the right answer survives the shuffle');}
 const aurora=SKIN_BASE+SKINS.findIndex(k=>k.id==='aurora');assert.equal(aurora,6);
 const p={badges:{},earnedAs:{},coats:{},bestRound:99};for(const b of BADGES)p.badges[b.id]=50;
 assert.ok(!coatUnlocked(p,'lion',aurora),'badges never open Aurora');
 p.quizBest=9;assert.ok(!coatUnlocked(p,'lion',aurora),'nine out of ten is not enough');
 p.quizPerfect=true;for(const s of ['lion','leopard','hyena','zebra','impala','warthog'])assert.ok(coatUnlocked(p,s,aurora));
 assert.equal(coatOf('666666','zebra'),6);
});
