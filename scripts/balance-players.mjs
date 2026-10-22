// Points per minute and survival by species for a scripted, greedy "player" (not the wildlife AI): each round puts
// two human slots of one species among the 60 wildlife and drives them like an attentive player would, using only what
// a player can know (the same senses that feed the HUD's tracking labels, food within ~60 m, the map's water).
//   node scripts/balance-players.mjs [rounds per species=3]
// It also runs the restart check: a player who restarts as soon as each life's quick task is done, against one who
// plays on, to show restarting is not a better way to score.
import {newPlayer,newRoom,start,tick,sense,props,interact,useAbility,ANIMALS,SPECIES,THIRSTY,FULL,KICK_RANGE,die,behind} from '../lib/game.ts';
const T0=1800000000000,STEP=100,SYNC=140,rounds=Number(process.argv[2]||3);
const ps=props(417),waters=ps.filter(p=>p.kind==='water');
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function drive(p,room,t,policy){
 const a=ANIMALS[p.species];let goal=null,sprint=false;
 const seen=room.players.filter(q=>q!==p&&!q.deadUntil&&sense(p,q,room,t,ps));
 const threats=seen.filter(q=>ANIMALS[q.species].prey.includes(p.species)&&d(p,q)<250);
 if(threats.length){const q=threats.sort((x,y)=>d(p,x)-d(p,y))[0];goal={x:p.x*2-q.x,y:p.y*2-q.y};sprint=true;
  // the prey's answer: zebra kicks back at a close pursuer, impala leaps, warthog dives into a burrow when one is near
  if(d(p,q)<(p.species==='zebra'?KICK_RANGE:70)&&(p.species!=='zebra'||behind(p,q)))useAbility(p,room,t);}
 else if(a.prey.length){
  const prey=seen.filter(q=>a.prey.includes(q.species)&&q.protectedUntil<t).sort((x,y)=>d(p,x)-d(p,y))[0];
  // creep in at a walk (fast movement is heard and seen), then burst from close range, as the real cats do
  if(prey&&p.hunger<FULL){const dd=d(p,prey),bolted=prey.mood==='flee',burst=p.species==='hyena'?260:110;goal={x:prey.x+(prey.vx||0)*.3,y:prey.y+(prey.vy||0)*.3};
   if(dd<burst||bolted){sprint=true;if(p.species!=='leopard')useAbility(p,room,t);}else{p._slow=true;if(p.species==='leopard'&&dd<230)useAbility(p,room,t);}}
 }
 if(!goal&&(p.thirst??100)<THIRSTY){const w=waters.sort((x,y)=>d(p,x)-d(p,y))[0];const n=d(p,w)||1;goal={x:w.x+(p.x-w.x)/n*(w.size+10),y:w.y+(p.y-w.y)/n*(w.size+10)};}
 if(!goal&&p.hunger<FULL){const f=room.foods.filter(f=>f.ready<=t&&(!f.until||f.until>t)&&a.foods.includes(f.kind)&&d(p,f)<(f.kind==='carrion'?700:600)).sort((x,y)=>d(p,x)-d(p,y))[0];if(f)goal=f;}
 if(!goal){if(!p._w||d(p,p._w)<40)p._w={x:300+Math.random()*3400,y:300+Math.random()*2200};goal=p._w;}
 const n=d(p,goal),pace=p._slow?.3:1;p._slow=false;p.dx=n>4?(goal.x-p.x)/n*pace:0;p.dy=n>4?(goal.y-p.y)/n*pace:0;p.sprint=sprint&&p.stamina>25;
 interact(p,room,t);
}
function round(species,r,policy='play'){
 const a=newPlayer('p1','P1',T0,false,species),b=newPlayer('p2','P2',T0,false,species);a.token='a';b.token='b';
 const room=newRoom('BAL'+r,a,T0);room.players.push(b);room.round=r*5+SPECIES.indexOf(species);start(room,T0);
 const me=room.players.filter(p=>!p.bot);for(const p of me){p.bag=Array(9).fill(species);Object.assign(p,{species});}
 const stat={deaths:{},lives:me.length,restarts:0};let next=T0;
 for(let t=T0+STEP;t<room.ends;t+=STEP){
  for(const p of me){p.lastSeen=t;if(!p.deadUntil){if(t>=next){p.inputAt=t;drive(p,room,t,policy);}
   // restart policy: as soon as this life has paid any quick species task, throw the life away for a fresh one
   if(p._c===undefined||p._born!==p.born){p._born=p.born;p._c=p.claimed.filter(Boolean).length;}
   if(policy==='restart'&&!p.deadUntil&&(p.claimed.filter(Boolean).length>p._c||p.survived>0)&&!p._r){p._r=1;stat.restarts++;die(p,room,t,'started a new life.');}}}
  if(t>=next)next=t+SYNC;
  const before=me.map(p=>p.deadUntil);tick(room,t);
  me.forEach((p,i)=>{if(!before[i]&&p.deadUntil){const why=(p.message||'').replace(/^.*(caught by|ran out of)/,'$1').slice(0,26);stat.deaths[why]=(stat.deaths[why]||0)+1;}
   if(before[i]&&!p.deadUntil){stat.lives++;p._r=0;p.bag=Array(9).fill(species);}});
 }
 return{points:me.reduce((s,p)=>s+p.score,0)/me.length,hunts:me.reduce((s,p)=>s+p.hunts,0)/me.length,stat};
}
const rows=[];
for(const species of SPECIES){let pts=0,hunts=0,lives=0;const deaths={};
 for(let r=0;r<rounds;r++){const o=round(species,r);pts+=o.points;hunts+=o.hunts;lives+=o.stat.lives;for(const[k,v]of Object.entries(o.stat.deaths))deaths[k]=(deaths[k]||0)+v;}
 rows.push({species,'pts/min':+(pts/rounds/5).toFixed(1),'hunts/round':+(hunts/rounds).toFixed(1),'lives/round':+(lives/rounds/2).toFixed(1),deaths:Object.entries(deaths).map(([k,v])=>k+' '+v).join('; ')||'none'});}
console.table(rows);
// restart check, on the species with the quickest task (zebra: drink) and a predator
for(const species of ['zebra','warthog','lion']){let play=0,rs=0;for(let r=0;r<rounds;r++){play+=round(species,r).points;rs+=round(species,r,'restart').points;}
 console.log(`restart check ${species}: play on ${(play/rounds).toFixed(0)} pts/round, restart after each quick task ${(rs/rounds).toFixed(0)} pts/round`);}
