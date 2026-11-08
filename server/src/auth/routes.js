import express from 'express';
import { AuthError } from './AuthService.js';
import { ipLimiter } from '../util/rateLimit.js';

export function createAuthRouter(auth) {
  const r = express.Router();
  r.use(ipLimiter(30, 60_000));
  const h = (fn) => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (e) {
      if (e instanceof AuthError) return res.status(e.status).json({ error: e.message });
      console.error(e); res.status(500).json({ error: 'Server error' });
    }
  };
  r.post('/guest', h((req) => auth.guest(req.body?.name)));
  r.post('/register', h((req) => auth.register(req.body?.username, req.body?.password)));
  r.post('/login', h((req) => auth.login(req.body?.username, req.body?.password)));
  r.get('/me', h((req) => ({ user: auth.me((req.headers.authorization || '').replace(/^Bearer /, '')) })));
  return r;
}
