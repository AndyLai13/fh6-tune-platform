const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token: string, secret: string, ip?: string): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  try {
    const r = await fetch(VERIFY_URL, { method: 'POST', body });
    const json: { success: boolean } = await r.json();
    return json.success === true;
  } catch {
    return false;
  }
}
