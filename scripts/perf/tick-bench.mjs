// Server/offline simulation cost: one human and the 60 wildlife slots, ticked every 140 ms (the client's sync rate)
// for a whole five-minute round, the human running in circles. Prints the mean and worst tick in milliseconds.
//   node scripts/perf/tick-bench.mjs [rounds=3]
import {newPlayer,newRoom,start,tick,publicRoom} from '../../lib/game.ts';
const rounds=Number(process.argv[2]||3),T0=1800000000000;let ticks=0,total=0,worst=0,json=0;
for(let r=0;r<rounds;r++){
 const host=newPlayer('perf','Perf',T0,false,'lion');host.token='t';const room=newRoom('PERFAA',host,T0);start(room,T0);
 for(let now=T0+140;now<room.ends;now+=140){
  const p=room.players[0];p.lastSeen=p.inputAt=now;const a=now/3000;p.dx=Math.cos(a);p.dy=Math.sin(a);p.sprint=Math.sin(now/7000)>0;
  const t=performance.now();tick(room,now);const ms=performance.now()-t;total+=ms;worst=Math.max(worst,ms);ticks++;
  if(ticks%10===0){const s=performance.now();JSON.stringify(publicRoom(room,now));json+=performance.now()-s;}
 }
}
console.log(JSON.stringify({ticks,meanTickMs:+(total/ticks).toFixed(3),worstTickMs:+worst.toFixed(2),publicRoomJsonMs:+(json/(ticks/10)).toFixed(3)}));
