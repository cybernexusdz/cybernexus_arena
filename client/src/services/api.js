const BASE = import.meta.env.VITE_SERVER_URL || '';
const KEY = 'fury.token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* noop */ } },
};

async function call(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api/auth${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new Error('Cannot reach the server. Check your connection.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}
export const api = {
  guest: (name) => call('/guest', { method: 'POST', body: { name } }),
  register: (username, password) => call('/register', { method: 'POST', body: { username, password } }),
  login: (username, password) => call('/login', { method: 'POST', body: { username, password } }),
  me: (token) => call('/me', { token }),
};
