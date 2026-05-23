import bcrypt from 'bcryptjs';

const PASSWORD_BLOCKLIST = new Set([
  'password', 'password1', 'qwerty', '123456', '12345678', 'letmein',
  'iloveyou', 'admin', 'welcome', 'monkey', 'dragon', 'master',
  'abc123', 'football', 'sunshine', '111111', 'qazwsx', '1q2w3e',
  'tune123', 'forza123', 'fh6', 'touge'
]);

export async function hashEditPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyEditPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export type PasswordCheck = { ok: true } | { ok: false; reason: 'too_short' | 'blocklisted' };

export function validatePasswordStrength(plain: string): PasswordCheck {
  if (plain.length < 6) return { ok: false, reason: 'too_short' };
  if (PASSWORD_BLOCKLIST.has(plain.toLowerCase())) return { ok: false, reason: 'blocklisted' };
  return { ok: true };
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signEditCookie(slug: string, secret: string, ttlSeconds: number): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${slug}.${expires}`;
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyEditCookie(cookie: string, expectedSlug: string, secret: string): Promise<boolean> {
  const parts = cookie.split('.');
  if (parts.length !== 3) return false;
  const [slug, expiresStr, sig] = parts;
  if (slug !== expectedSlug) return false;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expectedSig = await hmacSign(`${slug}.${expires}`, secret);
  if (sig.length !== expectedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) mismatch |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  return mismatch === 0;
}
