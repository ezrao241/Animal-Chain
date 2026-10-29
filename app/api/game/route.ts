import { env } from 'cloudflare:workers';
import { newPlayer,newRoom,type Room } from '@/lib/game';
import { roomRequest,viewFor,encode,IDLE_ROOM_MS } from '@/lib/net';
const json=(data:unknown,status=200)=>new Response(encode(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function POST(req:Request){try{
 if(!env.DB)return json({error:'The savanna is temporarily unavailable. Please try again.'},503);
 const b=await req.json() as Record<string,unknown>;const now=Date.now();const action=String(b.action||'');
 if(!['create','join','sync','start','practice','leave','restart','configure','end'].includes(action))return json({error:'Unknown game action.'},400);
 if(action==='create'){
 const name=String(b.name||'').trim().slice(0,18);if(!name)return json({error:'Choose a nickname first.'},400);
 // rooms nobody has synced with for a while are swept here, so abandoned rooms don't pile up
 await env.DB.prepare('DELETE FROM rooms WHERE updated<?').bind(now-IDLE_ROOM_MS).run();
 const id=crypto.randomUUID(),token=crypto.randomUUID();const host=newPlayer(id,name,now);host.token=token;
 for(let i=0;i<4;i++){const bytes=crypto.getRandomValues(new Uint8Array(6));const code=Array.from(bytes,x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');const room=newRoom(code,host,now);try{await env.DB.prepare('INSERT INTO rooms (code,state,version,updated) VALUES (?,?,0,?)').bind(code,JSON.stringify(room),now).run();return json({room:viewFor(room,id,now),id,token});}catch(e){if(i===3)throw e;}}
 }
 const code=String(b.code||'').toUpperCase();if(!/^[A-Z2-9]{6}$/.test(code))return json({error:'Enter a valid six-character room code.'},400);
 // optimistic concurrency: load, apply, write back only if nobody else wrote in between, else retry on the newer state
 for(let attempt=0;attempt<12;attempt++){
 const row=await env.DB.prepare('SELECT state,version,updated FROM rooms WHERE code=?').bind(code).first<{state:string;version:number;updated:number}>();if(!row||now-row.updated>IDLE_ROOM_MS)return json({error:'Room not found or expired. Create a new room.'},404);
 const room=JSON.parse(row.state) as Room;
 const out=roomRequest(room,b,action,now,()=>crypto.randomUUID());
 if(out.remove){const result=await env.DB.prepare('DELETE FROM rooms WHERE code=? AND version=?').bind(code,row.version).run();if(result.meta.changes)return json(out.body,out.status);continue;}
 if(!out.save)return json(out.body,out.status);
 const result=await env.DB.prepare('UPDATE rooms SET state=?, version=version+1, updated=? WHERE code=? AND version=?').bind(JSON.stringify(room),now,code,row.version).run();if(result.meta.changes)return json(out.body,out.status);
 }return json({error:'The savanna is busy. Reconnecting…'},503);
 }catch(e){console.error('Animal Chain game request failed',e);return json({error:'Could not reach the savanna. Your session is saved; try again.'},503);}}
