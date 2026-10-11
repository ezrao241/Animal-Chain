import { env } from 'cloudflare:workers';
import { newPlayer,newRoom,publicRoom,start,tick,useAbility,perch,interact,die,Room } from '@/lib/game';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){try{
 if(!env.DB)return json({error:'The forest is temporarily unavailable. Please try again.'},503);
 const b=await req.json() as Record<string,unknown>;const now=Date.now();const action=String(b.action||'');
 if(!['create','join','sync','start','practice','leave','restart'].includes(action))return json({error:'Unknown game action.'},400);
 if(action==='create'){
 const name=String(b.name||'').trim().slice(0,18);if(!name)return json({error:'Choose a nickname first.'},400);
 const id=crypto.randomUUID(),token=crypto.randomUUID();const host=newPlayer(id,name,now);host.token=token;
 for(let i=0;i<4;i++){const bytes=crypto.getRandomValues(new Uint8Array(6));const code=Array.from(bytes,x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');const room=newRoom(code,host,now);try{await env.DB.prepare('INSERT INTO rooms (code,state,version,updated) VALUES (?,?,0,?)').bind(code,JSON.stringify(room),now).run();return json({room:publicRoom(room,now),id,token});}catch(e){if(i===3)throw e;}}
 }
 const code=String(b.code||'').toUpperCase();if(!/^[A-Z2-9]{6}$/.test(code))return json({error:'Enter a valid six-character room code.'},400);
 for(let attempt=0;attempt<12;attempt++){
 const row=await env.DB.prepare('SELECT state,version,updated FROM rooms WHERE code=?').bind(code).first<{state:string;version:number;updated:number}>();if(!row||now-row.updated>86400000)return json({error:'Room not found or expired. Create a new room.'},404);
 const room=JSON.parse(row.state) as Room;tick(room,now);let p=room.players.find(p=>!p.bot&&typeof b.token==='string'&&p.id===b.id&&p.token===b.token);let credentials:{}|{id:string;token:string}={};
 if(action==='join'){
 const name=String(b.name||'').trim().slice(0,18);if(!name)return json({error:'Choose a nickname first.'},400);
 if(room.phase!=='lobby')return json({error:'This round has started. Join the next room or ask the host to play again.'},409);
 room.players=room.players.filter(q=>q.bot||now-q.lastSeen<90000);if(room.players.filter(q=>!q.bot).length>=8)return json({error:'This room is full (8 players).'},409);
 p=newPlayer(crypto.randomUUID(),name,now);p.token=crypto.randomUUID();room.players.push(p);credentials={id:p.id,token:p.token};
 }else{
 if(!p)return json({error:'Your session is no longer in this room. Please rejoin.'},401);
 p.lastSeen=now;
 if(action==='start'||action==='practice'){
 if(room.host!==p.id)return json({error:'Only the host can start the round.'},403);
 if(room.phase==='playing')return json({error:'The round is already running.'},409);
 const active=room.players.filter(q=>!q.bot&&now-q.lastSeen<8000);const practice=action==='practice';if(!practice&&active.length<2)return json({error:'Invite one more player to start, or choose solo practice.'},409);if(practice&&active.length!==1)return json({error:'Solo practice is for one player. Start a multiplayer round instead.'},409);room.practice=practice;room.players=active;start(room,now);
 }else if(action==='leave'){
 room.players=room.players.filter(q=>q.id!==p!.id);if(room.host===p.id)room.host=room.players.find(q=>!q.bot)?.id||'';
 }else if(action==='restart'){
 if(room.phase!=='playing')return json({error:'Start the round first.'},409);die(p,room,now,'started a new life.');
 }else if(room.phase==='playing'){
 const seq=Number(b.seq)||0;if(seq>p.seq){p.seq=seq;p.dx=typeof b.dx==='number'&&Number.isFinite(b.dx)?Math.max(-1,Math.min(1,b.dx)):0;p.dy=typeof b.dy==='number'&&Number.isFinite(b.dy)?Math.max(-1,Math.min(1,b.dy)):0;p.sprint=b.sprint===true;p.inputAt=now;
 if(b.ability===true)useAbility(p,room,now);if(b.perch===true)perch(p,room,now);if(b.interact===true)interact(p,room,now);}
 }
 }
 const result=await env.DB.prepare('UPDATE rooms SET state=?, version=version+1, updated=? WHERE code=? AND version=?').bind(JSON.stringify(room),now,code,row.version).run();if(result.meta.changes)return json({room:publicRoom(room,now),...credentials});
 }return json({error:'The forest is busy. Reconnecting…'},503);
 }catch(e){console.error('Animal Chain game request failed',e);return json({error:'Could not reach the forest. Your session is saved; try again.'},503);}}
