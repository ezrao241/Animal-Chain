// Server/offline simulation cost: N humans (default 1) and the 60 wildlife slots, ticked every 140 ms (the client's sync rate)
// for a whole five-minute round, each human running in its own circle. Prints the mean and worst tick in milliseconds.
//   node scripts/perf/tick-bench.mjs [rounds=3] [humans=1]
import {newPlayer,newRoom,start,tick,publicRoom} from '../../lib/game.ts';
const rounds=Number(process.argv[2]||3),humans=Number(process.argv[3]||1),T0=1800000000000;let ticks=0,total=0,worst=0,json=0;const all=[];
for(let r=0;r<rounds;r++){
 const host=newPlayer('perf','Perf',T0,false,'lion');host.token='t';const room=newRoom('PERFAA',host,T0);
 for(let i=1;i<humans;i++){const p=newPlayer('perf'+i,'Perf'+i,T0,false);p.token='t'+i;room.players.push(p);}
 start(room,T0);
 for(let now=T0+140;now<room.ends;now+=140){
  room.players.forEach((p,i)=>{if(p.bot)return;p.lastSeen=p.inputAt=now;const a=now/3000+i*.8;p.dx=Math.cos(a);p.dy=Math.sin(a);p.sprint=Math.sin(now/7000+i)>0;});
  const t=performance.now();tick(room,now);const ms=performance.now()-t;total+=ms;worst=Math.max(worst,ms);all.push(ms);ticks++;
  if(ticks%10===0){const s=performance.now();JSON.stringify(publicRoom(room,now));json+=performance.now()-s;}
 }
}
all.sort((a,b)=>a-b);
console.log(JSON.stringify({humans,ticks,meanTickMs:+(total/ticks).toFixed(3),p99TickMs:+all[Math.floor(all.length*.99)].toFixed(2),worstTickMs:+worst.toFixed(2),publicRoomJsonMs:+(json/(ticks/10)).toFixed(3)}));
