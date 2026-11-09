# CYBERNEXUS ARENA

Real-time 2D online fighting game. **React** (all UI) · **Phaser 3** (game canvas) · **Node + Express + Socket.IO** (server-authoritative simulation).
Rooms hold up to **8 players**: two fight 1v1, the rest spectate in a queue and rotate in after each match.

## Quick start

```bash
npm install                 # installs both workspaces (needs Node >= 20)
cp .env.example server/.env # optional in dev
npm run dev                 # server :3001 + Vite client :5173 (proxied)
```
Open http://localhost:5173 in two or more browser windows (use a private window for a second guest). Create a room in one, join with the code in the others, ready up both fighters, host presses **Start match**.

| Script | What it does |
|---|---|
| `npm run dev` | server (`node --watch`) + Vite dev server |
| `npm test` | server unit tests (Node built-in runner, no extra deps): combat, match, rooms, auth |
| `npm run build` | production client build → `client/dist` |
| `npm start` | production server; also serves `client/dist` if present |

**Controls:** A/D move · W/Space jump · S/Shift block (face the attacker) · J punch · K kick · L character special (six-second cooldown). Touch buttons appear on touch devices.

## Environment

Server (`server/.env`, see `.env.example`): `PORT`, `JWT_SECRET` (**required in production**), `CLIENT_ORIGIN` (comma list; only for split hosting), `USERS_FILE`, `RECONNECT_GRACE_MS`, `RESULTS_DELAY_MS`, `EMPTY_ROOM_TTL_MS`, `MAX_ROOMS`.
Client (`client/.env`): `VITE_SERVER_URL` only if the API is on a different origin.

## Architecture

```
shared/            protocol.js (limits, rules validation) + sim.js (deterministic fighter physics/combat, 60 Hz)
server/src/
  auth/            guest + account auth (scrypt, HMAC tokens), JSON user store, REST routes
  game/Match.js    authoritative 1v1: rounds, timer, input queues + validation, snapshots
  game/GameLoop.js fixed-timestep driver (60 Hz, bounded catch-up)
  rooms/Room.js    seats, queue, ready, host migration, grace/reconnect, rotation, results
  rooms/RoomManager.js  codes, discovery, one-room-per-user, cleanup sweep
  socket/index.js  Socket.IO wiring: auth middleware, rate limits, acks, session takeover
client/src/
  services/        api.js (REST), net.js (socket bus, request/ack, clock sync, latency)
  context/         Auth / Room / Settings providers
  components/      Auth, menu, browser, create, lobby, slots, queue, rules, match view, results, touch controls
  game/            createGame, scenes (Boot, Fight), entities (procedural rig, sprite, stage), systems (input, audio, fx), net (interpolation, prediction), ui/Hud, assets/manifest.js
```

### Netcode
* Clients send **only input bitmasks** (`{seq, bits}`), batched at 30 Hz. The server consumes exactly one frame per 60 Hz tick per fighter, so a client can't act faster than real time.
* Specials are character-specific move data in `shared/sim.js`; startup, active frames, recovery, damage, range, stun and cooldown are resolved by the same server-authoritative simulation used for prediction.
* Server validates every frame (type, range, strictly increasing `seq`, bounded jump, bounded queue), ignores spectators' input, rate-limits sockets, and computes movement, hit detection, blocking, damage, knockback, KO, timer and rounds itself.
* Snapshots go out at 30 Hz to the whole room (fighters and spectators) with full fighter state and a per-fighter `ack`.
* **Remote fighters / spectators:** clock sync (lowest-RTT offset) + 110 ms interpolation buffer.
* **Local fighter:** client-side prediction using the *same* `shared/sim.js`; on each snapshot it resets to server state and replays unacknowledged inputs (reconciliation), with smoothing for small errors and snapping for large ones. Attacks are also buffered 6 ticks.
* **Reconnects:** when a fighter's socket reconnects, queued server input is cleared and the client resets its sequence from the server acknowledgement before resuming controls. Rooms and matches still live in server memory, so a server restart or a different unshared server instance ends the room rather than resuming it.
* Hits are decided on the server at the time it processes inputs; there is no rewind/lag-compensated hit detection (a deliberate trade-off for simplicity — high-ping fighters feel the input delay on the opponent-facing side).

### Rooms
Public rooms are listed; private rooms are join-by-code only. Codes are 5 characters from an unambiguous alphabet and unique. Each user is in at most one room; a new login supersedes the old session. Disconnected players keep their seat for `RECONNECT_GRACE_MS`; the host role migrates immediately if the host drops. A fighter whose grace expires forfeits an active match. Empty rooms are removed immediately; rooms where everybody is offline are removed after `EMPTY_ROOM_TTL_MS`.

**Rotation** (host setting): *Winner stays* — winner keeps the slot, loser goes to the back of the queue, next spectator steps up. *Queue* — both fighters go to the back and the next two spectators fight. With no spectators the same two rematch. Results show for `RESULTS_DELAY_MS`, then the room returns to the lobby (host can skip).

### Socket events
Client→server (ack `{ok, ...}` or `{ok:false,error:{code,message}}`): `rooms:list`, `room:create`, `room:join`, `room:leave`, `room:ready`, `room:character`, `room:rules`, `room:start`, `room:continue`, `room:kick`, `clock:sync`; fire-and-forget `input`.
Server→client: `room:state`, `room:none|left|closed|kicked|notice|rotated`, `match:state` (30 Hz), `match:event` (countdown, hit, block, ko, roundEnd, matchEnd…), `match:result`, `session:replaced`.

## Replacing the placeholder art/sound
Edit `client/src/game/assets/manifest.js` (documented inline): add a sprite sheet + per-state animation ranges per character, background images per stage, and SFX URLs (put files in `client/public/assets/...`). Add new character ids in `shared/protocol.js` so the server accepts them. The procedural rig (`entities/rig.js`) is used whenever a character has no `sheet`.

## Tests
`npm test` runs the server and simulation regression suite: combat frame data/blocking/KO/trades/specials/determinism, match flow/validation/anti-speedhack, room lifecycle (cap, codes, privacy, host migration, reconnect, grace expiry, rotation modes, cleanup, rules, kick) and auth.

## Deployment
**Single container (simplest):** `docker build -t fury-arena . && docker run -p 3001:3001 -e JWT_SECRET=$(openssl rand -hex 32) -v fury-data:/app/server/data fury-arena`. Works on Fly.io, Railway, Render, a VPS, etc. — it needs a host that allows **long-lived WebSocket connections** (not serverless functions).

**Behind nginx/Caddy:** proxy `/` to `:3001` with WebSocket upgrade headers (`proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`) and a long `proxy_read_timeout`. Terminate TLS there.

**Split hosting:** build the client with `VITE_SERVER_URL=https://api.example.com`, host `client/dist` statically, and set the server's `CLIENT_ORIGIN` to the static site's origin.

**Vercel services:** `vercel.json` routes `/api/*` and `/socket.io/*` to the Docker-backed `server` service and all other paths to the Vite `client` service. Leave `VITE_SERVER_URL` unset so the browser uses these same-origin routes. Set `JWT_SECRET` in Vercel's server-service environment. The server currently keeps rooms in process memory and account data in a local JSON file; these are not shared or durable across service instances, so use a single persistent server instance or move that state to shared durable storage before relying on multi-instance production traffic. Socket.IO also depends on Vercel's WebSocket support.

**Persistence/scaling notes:** accounts live in a JSON file (mount a volume, or swap `UserStore` for a database). Room state is in-memory in one Node process (a 60 Hz sim for many rooms is light; one instance comfortably serves hundreds of rooms). To scale horizontally, shard by room code (sticky routing so all members of a room hit the same instance); room discovery would then need a shared index (e.g. Redis). Restarting the server drops live rooms.

## Honest status
Server logic and the shared simulation are covered by automated tests. The React/Phaser client and the Socket.IO wiring were written without being run in the authoring sandbox (no network for `npm install`), so expect to do a first-run pass: run `npm install && npm run dev` with two browser windows and report/fix anything that surfaces.
