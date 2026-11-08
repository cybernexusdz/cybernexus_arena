import 'dotenv/config';
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3001),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  usersFile: process.env.USERS_FILE || './data/users.json',
  graceMs: num(process.env.RECONNECT_GRACE_MS, 30000),
  resultsDelayMs: num(process.env.RESULTS_DELAY_MS, 8000),
  emptyRoomTtlMs: num(process.env.EMPTY_ROOM_TTL_MS, 60000),
  maxRooms: num(process.env.MAX_ROOMS, 500),
  sweepIntervalMs: 10000,
};
if (config.env === 'production' && config.jwtSecret === 'dev-only-secret-change-me') {
  console.error('FATAL: set JWT_SECRET in production'); process.exit(1);
}
