// Balance and ecosystem readout from computer-controlled rounds: every one of the 60 wildlife slots plays its species
// with the wildlife AI, and the script tallies, per species, points per minute, life length, how lives end, and the
// development metrics from the review: time to first food and to first detectable prey, gaps between chases, failed
// interactions (any "Missed..." message), and animals that stop moving while they mean to go somewhere.
//   node scripts/balance.mjs [rounds=4]
// The AI is not a human player, so this measures the rules' economy (what each species can earn and how long it
// lives under pressure), not how fun a species is in hand.
import {newPlayer,newRoom,start,tick,sense,props,ANIMALS,SPECIES} from '../lib/game.ts';
const rounds=Number(process.argv[2]||4),T0=1800000000000,STEP=140;
const S=Object.fromEntries(SPECIES.map(s=>[s,{lives:0,seconds:0,points:0,deaths:{},firstFood:[],firstPrey:[],chaseGaps:[],missed:0,stuck:0,windows:0,hunts:0,food:0,drinks:0,escapes:0}]));
const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
for(let r=0;r<rounds;r++){
 // a human host who sits still out of the way, only so the room can start
 const host=newPlayer('obs','Observer',T0,false,'zebra');host.token='t';const room=newRoom('BALAN'+r,host,T0);room.seed=417;room.round=r*7;start(room,T0);
 const ps=props(room.seed),obs=room.players[0];
 const life=new Map(),last=new Map();
 const begin=(p,t)=>life.set(p.id,{born:t,species:p.species,score:p.score,food:p.food,prey:null,fed:null,lastChase:null,mood:p.mood,msg:p.message,x:p.x,y:p.y,wx:p.x,wy:p.y,wt:t});
 for(const p of room.players)if(p.bot)begin(p,T0);
 for(let t=T0+STEP;t<room.ends;t+=STEP){
  Object.assign(obs,{lastSeen:t,inputAt:t,deadUntil:0,protectedUntil:Infinity,x:20,y:20,hunger:100,thirst:100});
  tick(room,t);
  for(const p of room.players){if(!p.bot)continue;const L=life.get(p.id),s=S[L.species];
   if(p.deadUntil&&!L.dead){L.dead=true;s.lives++;s.seconds+=(t-L.born)/1000;s.points+=p.score-L.score;const why=(p.message||'').replace(/^.* (was caught by|ran out of)/,'$1').slice(0,28);s.deaths[why]=(s.deaths[why]||0)+1;continue;}
   if(L.dead&&!p.deadUntil){begin(p,t);continue;}if(p.deadUntil)continue;
   if(p.message!==L.msg){if(/^Missed/.test(p.message))s.missed++;L.msg=p.message;}
   if(L.fed===null&&p.food>L.food){L.fed=(t-L.born)/1000;s.firstFood.push(L.fed);}
   const a=ANIMALS[p.species];
   if(a.prey.length&&L.prey===null&&room.players.some(q=>!q.deadUntil&&a.prey.includes(q.species)&&sense(p,q,room,t,ps))){L.prey=(t-L.born)/1000;s.firstPrey.push(L.prey);}
   if(p.mood==='chase'&&L.mood!=='chase'){if(L.lastChase)s.chaseGaps.push((t-L.lastChase)/1000);L.lastChase=t;}L.mood=p.mood;
   // stuck: in a 10 s window it wanted to travel (a goal well away) but covered under 2 m
   if(t-L.wt>=10000){s.windows++;const moved=Math.hypot(p.x-L.wx,p.y-L.wy),wants=Math.hypot((p.targetX||p.x)-p.x,(p.targetY||p.y)-p.y)>60;if(wants&&moved<20&&!p.perched)s.stuck++;L.wx=p.x;L.wy=p.y;L.wt=t;}
  }
 }
 for(const p of room.players){if(!p.bot)continue;const L=life.get(p.id),s=S[L.species];if(!L.dead){s.lives++;s.seconds+=(room.ends-L.born)/1000;s.points+=p.score-L.score;s.deaths['alive at the end']=(s.deaths['alive at the end']||0)+1;}s.hunts+=p.hunts;s.food+=p.food;s.drinks+=p.drinks;s.escapes+=p.escapes;}
}
const rows=SPECIES.map(sp=>{const s=S[sp];return{species:sp,lives:s.lives,'pts/min':+(s.points/(s.seconds/60)).toFixed(1),'mean life s':+(s.seconds/s.lives).toFixed(0),
 'first food s (median)':median(s.firstFood)?.toFixed(0)??'-','first prey seen s (median)':median(s.firstPrey)?.toFixed(0)??'-','chase gap s (median)':median(s.chaseGaps)?.toFixed(0)??'-',
 'missed per min':+(s.missed/(s.seconds/60)).toFixed(2),'stuck %':+(100*s.stuck/Math.max(1,s.windows)).toFixed(1),deaths:Object.entries(s.deaths).map(([k,v])=>k+': '+v).join('; ')};});
console.table(rows.map(({deaths,...r})=>r));for(const r of rows)console.log(r.species.padEnd(8),r.deaths);
