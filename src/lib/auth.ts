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
