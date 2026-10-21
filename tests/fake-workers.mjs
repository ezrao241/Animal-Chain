// A tiny D1 stand-in with the three statements the game route uses. Reads and writes yield to the event loop at random,
// so concurrent requests interleave like real network round trips and the route's version check is exercised.
const rows=new Map();const pause=()=>new Promise(r=>setTimeout(r,Math.random()*6));
export const db={rows,writes:0,conflicts:0};
function statement(sql,args=[]){return{
 bind:(...a)=>statement(sql,a),
 async first(){await pause();const row=rows.get(args[0]);return row?{...row}:null;},
 async run(){await pause();
  if(sql.startsWith('INSERT')){if(rows.has(args[0]))throw new Error('UNIQUE');rows.set(args[0],{state:args[1],version:0,updated:args[2]});return{meta:{changes:1}};}
  if(sql.startsWith('UPDATE')){const[state,updated,code,version]=args,row=rows.get(code);if(!row||row.version!==version){db.conflicts++;return{meta:{changes:0}};}rows.set(code,{state,version:version+1,updated});db.writes++;return{meta:{changes:1}};}
  throw new Error('unexpected SQL '+sql);}
};}
export const env={DB:{prepare:sql=>statement(sql)}};
