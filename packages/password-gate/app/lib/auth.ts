// Password gate for one site. lib/gate.json is written by the password-gate package's build hook:
// the login page's text, the cookie settings, a salted PBKDF2 hash of the password (never the
// password itself) and a random signing secret. Sessions are an expiring, HMAC-signed cookie; a new
// password comes with a new secret, which signs everyone out. With no hash in gate.json (as in the
// copy kept in the template) nobody can sign in.
import gateFile from './gate.json' with { type: 'json' };

export type Labels = { intro: string; password: string; wrong: string; submit: string };
export type Gate = {
  title: string; lang?: string; labels?: Partial<Labels>; cookie?: string; maxAge?: number;
  salt: string; hash: string; iterations: number; secret: string;
};

const DEFAULT_LABELS: Labels = {
  intro: 'This site is private. Enter the password to continue.',
  password: 'Password',
  wrong: 'That password isn’t right.',
  submit: 'Continue',
};

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function pbkdf2(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256));
}

async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}

export function makeAuth(gate: Gate) {
  const ready = Boolean(gate.hash && gate.salt && gate.secret && gate.secret.length >= 32 && gate.iterations > 0);
  const maxAge = gate.maxAge && gate.maxAge > 0 ? gate.maxAge : 60 * 60 * 24 * 30;
  return {
    title: gate.title || 'Private site',
    lang: gate.lang || 'en',
    labels: { ...DEFAULT_LABELS, ...(gate.labels || {}) } as Labels,
    cookie: gate.cookie || 'study_session',
    maxAge, // seconds
    async checkPassword(given: string) {
      if (!ready) return false;
      return same(await pbkdf2(given, gate.salt, gate.iterations), gate.hash);
    },
    async makeToken(now = Date.now()) {
      if (!ready) throw new Error('lib/gate.json has no password; build the site with the password-gate package');
      const exp = Math.floor(now / 1000) + maxAge;
      return `${exp}.${await hmac(gate.secret, `v1.${exp}`)}`;
    },
    async verifyToken(token: string | undefined, now = Date.now()) {
      if (!ready || !token) return false;
      const [expStr, sig] = token.split('.');
      const exp = Number(expStr);
      if (!Number.isInteger(exp) || !sig || exp < now / 1000) return false;
      return same(sig, await hmac(gate.secret, `v1.${exp}`));
    },
  };
}

export const auth = makeAuth(gateFile as Gate);

/** Only same-site paths may be returned to after signing in. */
export function safeNext(next: unknown) {
  const n = typeof next === 'string' ? next : '';
  return n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : '/';
}
