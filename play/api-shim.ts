// In-browser stand-in for app/api/game/route.ts: the same room logic from lib/game.ts, with rooms kept in memory instead of
// the Cloudflare D1 database. Only solo practice makes sense here (other players can't reach this browser).
import {newPlayer, newRoom, publicRoom, start, tick, useAbility, perch, interact, die, Room} from '@/lib/game';

const rooms = new Map<string, Room>();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json'}});

function handle(b: Record<string, unknown>): Response {
  const now = Date.now(), action = String(b.action || '');
  if (!['create', 'join', 'sync', 'start', 'practice', 'leave', 'restart'].includes(action)) return json({error: 'Unknown game action.'}, 400);
  if (action === 'create') {
    const name = String(b.name || '').trim().slice(0, 18); if (!name) return json({error: 'Choose a nickname first.'}, 400);
    const id = crypto.randomUUID(), token = crypto.randomUUID(); const host = newPlayer(id, name, now); host.token = token;
    const bytes = crypto.getRandomValues(new Uint8Array(6)); const code = Array.from(bytes, x => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
    const room = newRoom(code, host, now); rooms.set(code, room); return json({room: publicRoom(room, now), id, token});
  }
  const code = String(b.code || '').toUpperCase(); const room = rooms.get(code);
  if (!room) return json({error: 'This offline copy only runs rooms created in this tab. Create a new room.'}, 404);
  tick(room, now);
  const p = room.players.find(p => !p.bot && typeof b.token === 'string' && p.id === b.id && p.token === b.token);
  if (action === 'join') return json({error: 'Multiplayer needs the hosted game. Create a room and choose solo practice.'}, 409);
  if (!p) return json({error: 'Your session is no longer in this room. Please rejoin.'}, 401);
  p.lastSeen = now;
  if (action === 'start' || action === 'practice') {
    if (room.phase === 'playing') return json({error: 'The round is already running.'}, 409);
    room.practice = true; room.players = room.players.filter(q => !q.bot && q.id === p.id); start(room, now);
  } else if (action === 'leave') {
    room.players = room.players.filter(q => q.id !== p.id); rooms.delete(code);
  } else if (action === 'restart') {
    if (room.phase !== 'playing') return json({error: 'Start the round first.'}, 409); die(p, room, now, 'started a new life.');
  } else if (room.phase === 'playing') {
    const seq = Number(b.seq) || 0;
    if (seq > p.seq) {
      p.seq = seq; p.dx = typeof b.dx === 'number' && Number.isFinite(b.dx) ? Math.max(-1, Math.min(1, b.dx)) : 0;
      p.dy = typeof b.dy === 'number' && Number.isFinite(b.dy) ? Math.max(-1, Math.min(1, b.dy)) : 0; p.sprint = b.sprint === true; p.inputAt = now;
      if (b.ability === true) useAbility(p, room, now); if (b.perch === true) perch(p, room, now); if (b.interact === true) interact(p, room, now);
    }
  }
  return json({room: publicRoom(room, now)});
}

// Binary files (glb, bin, hdr) are published as base64 text pieces; decode and stitch them back together on fetch.
const SPLIT: Record<string, number> = (globalThis as any).__ANIMAL_CHAIN_SPLIT || {};
const decode = (b64: string) => { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
export function installShim() {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (/\/api\/game$/.test(url)) { try { return handle(JSON.parse(String(init?.body || '{}'))); } catch (e) { console.error(e); return json({error: 'Could not reach the savanna.'}, 503); } }
    const name = Object.keys(SPLIT).find(n => url.split(/[?#]/)[0].endsWith('/' + n));
    if (name) {
      const parts = await Promise.all(Array.from({length: SPLIT[name]}, (_, i) => real(`${url}.part${i}.txt`).then(r => r.text()).then(decode)));
      return new Response(new Blob(parts), {status: 200, headers: {'Content-Type': 'application/octet-stream'}});
    }
    return real(input as any, init);
  };
}
