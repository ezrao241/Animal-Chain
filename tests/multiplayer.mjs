// Integration smoke test against the supervised preview, never production.
// Creates isolated test rooms and leaves them at the end.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),origin=process.env.TEST_ORIGIN||'http://terminal.local:4173';
assert.match(origin,/^http:\/\/(terminal\.local|localhost|127\.0\.0\.1):\d+$/,'Only a local test host is permitted');
async function api(body,expected=200){
 const {stdout}=await run('curl',['--silent','--show-error','--max-time','20','-H','Content-Type: application/json','-X','POST','--data-binary',JSON.stringify(body),'-w','\n%{http_code}',origin+'/api/game'],{maxBuffer:4*1024*1024});
 const split=stdout.lastIndexOf('\n'),status=Number(stdout.slice(split+1));let data;try{data=JSON.parse(stdout.slice(0,split));}catch{throw new Error(`Non-JSON response: HTTP ${status}`);}
 assert.equal(status,expected,`${body.action}: ${data.error||'unexpected response'}`);return data;
}
const auth=d=>({code:d.room.code,id:d.id,token:d.token});
const sessions=[];let seq=Date.now();
try{
 const host=await api({action:'create',name:'QA host'});sessions.push(auth(host));
 await api({action:'start',...auth(host)},409);
 const guest=await api({action:'join',name:'QA guest',code:host.room.code});sessions.push(auth(guest));
 assert.equal(guest.room.players.filter(p=>!p.bot).length,2);
 await api({action:'start',...auth(guest)},403);
 const started=await api({action:'start',...auth(host)});
 assert.equal(started.room.phase,'playing');assert.equal(started.room.practice,false);assert.equal(started.room.ends-started.room.started,300000);assert.equal(started.room.players.length,62);
 await api({action:'sync',code:host.room.code,id:'wild-0',seq:1},401);
 await api({action:'sync',...auth(guest),token:'invalid-token'},401);
 await api({action:'join',code:host.room.code,name:'Late player'},409);
 const before=started.room.players.find(p=>p.id===host.id);
 for(let i=0;i<10;i++){
  const snapshots=await Promise.all([api({action:'sync',...auth(host),seq:++seq,dx:1,dy:0,sprint:true}),api({action:'sync',...auth(guest),seq:++seq,dx:0,dy:1})]);
  for(const {room}of snapshots){assert.equal(room.phase,'playing');assert.equal(room.ends,started.room.ends);assert.equal(room.players.filter(p=>!p.bot).length,2);assert.equal(room.players.some(p=>'token' in p),false);}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 const seenByGuest=await api({action:'sync',...auth(guest),seq:++seq,dx:0,dy:0}),after=seenByGuest.room.players.find(p=>p.id===host.id);
 assert.ok(Math.hypot(before.x-after.x,before.y-after.y)>15,'Guest sees the host move in shared state');
 const dead=await api({action:'restart',...auth(host)});assert.ok(dead.room.players.find(p=>p.id===host.id).deadUntil);
 const leave=await api({action:'leave',...auth(host)});assert.equal(leave.room.host,guest.id);sessions.shift();
 const practice=await api({action:'create',name:'QA practice'});sessions.push(auth(practice));
 const solo=await api({action:'practice',...auth(practice)});assert.equal(solo.room.phase,'playing');assert.equal(solo.room.practice,true);assert.equal(solo.room.players.length,25);
 console.log('PASS: separate sessions, synchronized movement/timer, host-only start, 5-minute rounds, bot authentication blocked, no token leakage, restart, host migration, solo practice.');
}finally{
 for(const s of sessions)await api({action:'leave',...s}).catch(e=>console.warn('Test-room cleanup:',e.message));
}
