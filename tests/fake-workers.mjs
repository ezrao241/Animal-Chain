// A tiny D1 stand-in with the statements the game route uses. Reads and writes yield to the event loop at random,
// so concurrent requests interleave like real network round trips and the route's version check is exercised.
// Set db.instant=true (benchmarks) to skip the random pauses, or db.latency=<ms> for a round trip of about that long (0.6-1.4x).
const rows=new Map();const pause=()=>db.instant?Promise.resolve():new Promise(r=>setTimeout(r,db.latency?db.latency*(.6+Math.random()*.8):Math.random()*6));
export const db={rows,reads:0,writes:0,conflicts:0,deletes:0,instant:false,latency:0};
function statement(sql,args=[]){return{
 bind:(...a)=>statement(sql,a),
 async first(){await pause();db.reads++;const row=rows.get(args[0]);return row?{...row}:null;},
 async run(){await pause();
  if(sql.startsWith('INSERT')){if(rows.has(args[0]))throw new Error('UNIQUE');rows.set(args[0],{state:args[1],version:0,updated:args[2]});return{meta:{changes:1}};}
  if(sql.startsWith('UPDATE')){const[state,updated,code,version]=args,row=rows.get(code);if(!row||row.version!==version){db.conflicts++;return{meta:{changes:0}};}rows.set(code,{state,version:version+1,updated});db.writes++;return{meta:{changes:1}};}
  if(sql.startsWith('DELETE FROM rooms WHERE code=? AND version=?')){const[code,version]=args,row=rows.get(code);if(!row||row.version!==version)return{meta:{changes:0}};rows.delete(code);db.deletes++;return{meta:{changes:1}};}
  if(sql.startsWith('DELETE FROM rooms WHERE updated<?')){let n=0;for(const [code,row]of rows)if(row.updated<args[0]){rows.delete(code);n++;}db.deletes+=n;return{meta:{changes:n}};}
  throw new Error('unexpected SQL '+sql);}
};}
export const env={DB:{prepare:sql=>statement(sql)}};
