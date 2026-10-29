// In-browser stand-in for app/api/game/route.ts: the same room logic from lib/game.ts, with rooms kept in memory instead of
// the Cloudflare D1 database. Only solo practice makes sense here (other players can't reach this browser).
import {newPlayer, newRoom, Room} from '@/lib/game';
import {roomRequest, viewFor, encode} from '@/lib/net';

const rooms = new Map<string, Room>();
// Exposed for the browser QA harness (scripted checks drive and inspect the offline room); harmless in a solo copy.
(globalThis as typeof globalThis & {__animalChainRooms?: typeof rooms}).__animalChainRooms = rooms;
const json = (data: unknown, status = 200) => new Response(encode(data), {status, headers: {'Content-Type': 'application/json'}});

function handle(b: Record<string, unknown>): Response {
  const now = Date.now(), action = String(b.action || '');
  if (!['create', 'join', 'sync', 'start', 'practice', 'leave', 'restart', 'configure', 'end'].includes(action)) return json({error: 'Unknown game action.'}, 400);
  if (action === 'create') {
    const name = String(b.name || '').trim().slice(0, 18); if (!name) return json({error: 'Choose a nickname first.'}, 400);
    const id = crypto.randomUUID(), token = crypto.randomUUID(); const host = newPlayer(id, name, now); host.token = token;
    const bytes = crypto.getRandomValues(new Uint8Array(6)); const code = Array.from(bytes, x => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
    const room = newRoom(code, host, now); rooms.set(code, room); return json({room: viewFor(room, id, now), id, token});
  }
  const code = String(b.code || '').toUpperCase(); const room = rooms.get(code);
  if (!room) return json({error: 'This offline copy only runs rooms created in this tab. Create a new room.'}, 404);
  if (action === 'join' && b.token === undefined) return json({error: 'Multiplayer needs the hosted game. Create a room and choose solo practice.'}, 409);
  // the same session rules as the hosted route; only solo practice makes sense here
  const out = roomRequest(room, b, action === 'start' ? 'practice' : action, now, () => crypto.randomUUID());
  if (out.remove) rooms.delete(code);
  return json(out.body, out.status);
}

// Binary files (glb, bin, hdr) are published as base64 text pieces; decode and stitch them back together on fetch.
const SPLIT: Record<string, number> = (globalThis as any).__ANIMAL_CHAIN_SPLIT || {};
const decode = (b64: string) => { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
export function installShim() {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // ?server: leave /api/game to a real server (scripts/mp-harness.mjs serves this build with the multiplayer route)
    if (/\/api\/game$/.test(url) && !new URLSearchParams(location.search).has('server')) { try { return handle(JSON.parse(String(init?.body || '{}'))); } catch (e) { console.error(e); return json({error: 'Could not reach the savanna.'}, 503); } }
    const name = Object.keys(SPLIT).find(n => url.split(/[?#]/)[0].endsWith('/' + n));
    if (name) {
      const parts = await Promise.all(Array.from({length: SPLIT[name]}, (_, i) => real(`${url}.part${i}.txt`).then(r => r.text()).then(decode)));
      return new Response(new Blob(parts), {status: 200, headers: {'Content-Type': 'application/octet-stream'}});
    }
    return real(input as any, init);
  };
}
