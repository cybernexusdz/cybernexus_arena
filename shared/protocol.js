// Shared constants + validation used by BOTH server and client.
export const MAX_PLAYERS = 8;
export const ROTATION = Object.freeze({ WINNER_STAYS: 'winner-stays', QUEUE: 'queue' });
export const ROOM_PHASE = Object.freeze({ LOBBY: 'lobby', MATCH: 'match', RESULTS: 'results' });
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

export const CHARACTERS = Object.freeze([
  { id: 'azure', name: 'Azure', color: '#2f9bff' },
  { id: 'crimson', name: 'Crimson', color: '#ff3b4e' },
  { id: 'verdant', name: 'Verdant', color: '#38d27a' },
  { id: 'solar', name: 'Solar', color: '#ffb13b' },
  { id: 'ethan', name: 'Ethan', color: '#52dbe3' },
  { id: 'ella', name: 'Ella', color: '#e65ad5' },
]);
export const STAGES = Object.freeze(['dojo', 'harbor', 'rooftop']);

export const DEFAULT_RULES = Object.freeze({
  roundsToWin: 2,
  roundTime: 60,
  maxHealth: 100,
  damageMultiplier: 1,
  rotation: ROTATION.WINNER_STAYS,
  stage: 'dojo',
});
export const RULE_LIMITS = Object.freeze({
  roundsToWin: [1, 5],
  roundTime: [15, 99],
  maxHealth: [50, 200],
  damageMultiplier: [0.5, 2],
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function sanitizeRules(input, base = DEFAULT_RULES) {
  const out = { ...base };
  if (!input || typeof input !== 'object') return out;
  for (const [key, [lo, hi]] of Object.entries(RULE_LIMITS)) {
    if (input[key] === undefined) continue;
    const n = Number(input[key]);
    if (!Number.isFinite(n)) continue;
    out[key] = clamp(key === 'damageMultiplier' ? Math.round(n * 10) / 10 : Math.round(n), lo, hi);
  }
  if (Object.values(ROTATION).includes(input.rotation)) out.rotation = input.rotation;
  if (STAGES.includes(input.stage)) out.stage = input.stage;
  return out;
}

export function sanitizeName(raw, fallback = 'Player', min = 2, max = 16) {
  if (typeof raw !== 'string') return fallback;
  const s = raw.replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return s.length >= min ? s : fallback;
}

export const normalizeCode = (c) => (typeof c === 'string' ? c.trim().toUpperCase() : '');
