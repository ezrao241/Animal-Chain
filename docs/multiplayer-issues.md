# Multiplayer issue log

Server and networking findings from the October 2026 review, how each was reproduced, and what changed.
Room-session code is in `lib/net.ts`; `app/api/game/route.ts` (D1) and `play/api-shim.ts` (offline) both call it.
Game rules stay in `lib/game.ts`.

| # | Issue | Reproduction (fails on the old route) | Fix | Regression test |
|---|---|---|---|---|
| 1 | The route test failed about 1 run in 10 | 40 repeated runs: 6 failures, all "respawned as impala again". Once the lunge windup landed, a second cause appeared: a still impala that spawned in a thicket counts as hidden and can't be caught | The test forced the guest to be an impala without taking impala out of its species bag, so the bag could deal impala next. The test now updates the bag and stages the encounter on open ground. Before, the guest could spawn still inside a thicket, which hides it from the lion | 130 repeated runs, 0 failures |
| 2 | An away host stranded the lobby ("Only the host can start") | Host silent 12 s: guest's start → 403. Host dropped as stale: `room.host` still pointed at them | `settleRoom`: after a 10 s grace the earliest-joined online player becomes host. If the host has gone entirely, the most recently seen player takes over | `an away host hands the lobby…`, `a host removed as stale…` |
| 3 | Concealed animals' exact coordinates went to every client | A burrowed warthog appeared in the other player's response with x/y | `viewFor`: a concealed animal is left out for everyone but its own player. A roster lists every human for the lobby and scores. Credentials, inputs, AI targets and plans, task progress, private messages, cooldowns and the room RNG state are no longer sent for other animals | `hidden animals, AI plans…` (checks the serialized text), browser check |
| 4 | One-shot presses were lost on a failed request, and a stale press could act after a respawn | The client cleared E/Space/Q before the request. Presses had no id or life | Presses carry an id, increasing per player, plus the life they were made in. The client resends a press until the server acknowledges it (`act`). The server runs each id at most once. It drops a press from an earlier life, a press made while dead or outside a round, and a press more than 1.5 s old | `one-shot actions run once…`, `a lunge committed before a new life…` |
| 5 | Repeated start requests | A double click returned a 409 error to the second request | When the round is already running, the host's repeated start gets 200 and the same round. Version checks still allow only one start | `…repeated starts make one round` |
| 6 | Empty and abandoned rooms lingered for 24 h | The last player left, but the row stayed | The last human leaving deletes the room. A room nobody has synced with for 30 min returns 404, and these rooms are swept whenever a room is created | `the last human leaving deletes the room…` |
| 7 | Rejoining created a duplicate player | `join` always made a new player | A `join` that carries a valid id and token for the room returns that player | `…a reconnecting player keeps their animal` |
| 8 | Every poll sent the full room (≈122 KB) and wrote the full state to D1 | `scripts/perf/sync-bench.mjs` (below) | Per-player view. Food goes out as changes from the seed layout. Animals more than 115 m away are sent with only the fields their tracks need. Fractions are rounded to 0.01. A sync with nothing new, arriving within 60 ms of the last tick, is answered from stored state with no tick and no write | `a quiet sync…`, `the client rebuilds exactly the server food table…` |

## Sync cost (`node scripts/perf/sync-bench.mjs <players> 60`)

Simulated clock, every player polling every 140 ms with keyboard-style input. Results are from the in-memory D1, so they show payload and write counts, not D1 latency.

| | Response per poll | Download per room | D1 writes per poll | Writes per second | Server CPU per poll |
|---|---|---|---|---|---|
| 2 players, before | 122.9 KB | 1716 KB/s | 1.00 | 14.3 | 5.3 ms |
| 2 players, after | 21.2 KB | 296 KB/s | 1.00 | 14.3 | 4.2 ms |
| 8 players, before | 130.4 KB | 7276 KB/s | 1.00 | 57.1 | 6.0 ms |
| 8 players, after | 21.7 KB | 1212 KB/s | 0.39 | 22.4 | 3.0 ms |

The stored state is still about 127 KB per write. Fixing that needs the room held in memory, for example in a Durable Object, rather than in a D1 row, and the deployment target for that isn't set up. Each poll still costs one D1 read.

## Browser check (`node scripts/mp-playtest.mjs`)

This check opens two separate Chromium contexts, each with its own storage, running the real game page and the real route behind a local HTTP server. It covers the lobby roster on both clients, the host's start button, Space running once and being acknowledged, a burrowed warthog missing from the other client's actual responses, host hand-off after the host's tab closes, and a reload resuming the same animal. The browser uses a software GPU at about 5 fps, so the client sent only about one poll per second here. Real-hardware poll rates, eight players, phones and real network latency were not tested.

## Lag and snap-back (2026-10-29)

Players reported their animal lagging and snapping back. There were four causes:

1. **The server decided where your own animal was, and the client pulled toward it.** The page predicted movement locally, but the server only hears a key change after the next poll plus the trip there, so its copy is always a few tenths of a second behind. The client kept easing toward that older position, and when the gap passed 10 m it pulled back hard. That pull is the snap-back.
2. **A slow request stopped the animal on the server.** `tick()` zeroed a player's input when there was no sync for 800 ms. One slow D1 round trip (or a retry under contention) was enough to stop the animal on the server, and the client was then dragged back to the stop.
3. **Slow frames ran the animal in slow motion.** The frame step was capped at 75 ms, so a device drawing 10 fps moved its own animal at three quarters of its real speed, and the server's copy ran ahead.
4. **The room clock could step backwards.** A retried request (or another Worker's slightly earlier clock) wrote `room.tick=now` with an earlier `now`, so the next request simulated the same stretch again.

Fixes:

- **The device moves its own animal and reports where it got to** (`claim` in `lib/net.ts`). Every sync carries the predicted `x, y, vx, vy` and the life (`born`). The server takes that position when the animal could have run there: the distance from the last accepted position must fit the species' top speed (sprint or leap, plus 10%) over the time between syncs, with a 9 m allowance for network jitter that is banked between syncs, so sustained running faster than top speed is refused. The server keeps the animal while it holds it: dead, climbing or in a tree, stunned by a kick, or down a burrow. A refused position bumps `fix` (sent only to the owner), and the device then eases back onto the server's animal for about half a second. Older clients that send no position get the old behaviour.
- The client no longer eases toward the server's position. It does so only while the server holds the animal, or just after a refusal.
- The input timeout went from 800 ms to 2 s. The 8 s away rule is unchanged.
- The own animal's movement is stepped in 50 ms slices for the full frame time (up to 250 ms), so it keeps its real speed at any frame rate.
- `roomRequest` never moves `room.tick` backwards.
- A sync with unchanged keys is still coalesced, but not when it reports a new position.
- In a round, the next sync is sent 140 ms after the previous one was sent, not 140 ms after its answer arrived. This raises the poll rate on slow connections.
- Other animals are carried forward along their last reported velocity for up to about one measured update interval (0.15 to 0.6 s). The old cap was a fixed 0.3 s, so on slow connections they froze and then jumped.

The trade-off is that a modified client can still move up to top speed without spending stamina, and can shift its position by up to the 9 m jitter allowance. Teleporting, running faster than top speed, and moving while held all stay impossible.

`node scripts/perf/lag-test.mjs [dist-play]` runs two browser sessions against the real route, with every answer delayed by `LAG_MS` ± `JITTER_MS` (default 250 ± 120). The host sprints straight for 5 s, turns round for 3 s, then stops. In headless SwiftShader at about 4 fps, the old build moved 22 m on screen while the server moved 47 m, then kept running about 50 m forward after S was pressed while it caught up. The new build moved 64 to 70 m in the sprint, reversed at once, and its server copy matched.

## Not changed

- Tab close is not sent as an explicit leave. A reload looks the same as a close, so closing a tab relies on the grace period.
- A player who is away during a round keeps their animal and score. They can only rejoin a round in progress if their session is still valid.
- There are no WebSockets and no new hosting.
