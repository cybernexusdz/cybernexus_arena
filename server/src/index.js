import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { config } from './config.js';
import { UserStore } from './auth/UserStore.js';
import { AuthService } from './auth/AuthService.js';
import { createAuthRouter } from './auth/routes.js';
import { RoomManager } from './rooms/RoomManager.js';
import { GameLoop } from './game/GameLoop.js';
import { attachSocketServer, createTransport } from './socket/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors({ origin: config.clientOrigins }));
app.use(express.json({ limit: '10kb' }));

const auth = new AuthService({ store: new UserStore(path.resolve(config.usersFile)), secret: config.jwtSecret });
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.clientOrigins },
  maxHttpBufferSize: 10_000,   // inputs are tiny; reject big payloads
  pingInterval: 10_000, pingTimeout: 10_000,
});
const manager = new RoomManager({ transport: createTransport(io), config, onResult: (r) => auth.recordResult(r.winnerId, r.loserId) });

app.use('/api/auth', createAuthRouter(auth));
app.get('/api/health', (_req, res) => res.json({ ok: true, ...manager.stats(), uptime: process.uptime() }));

// Serve the built React app in production (single-process deploy).
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

attachSocketServer(io, { auth, manager });
const loop = new GameLoop(manager); loop.start();
const sweeper = setInterval(() => manager.sweep(), config.sweepIntervalMs); sweeper.unref();

server.listen(config.port, () => console.log(`Fury Arena server listening on :${config.port} (${config.env})`));
const shutdown = () => { loop.stop(); io.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
