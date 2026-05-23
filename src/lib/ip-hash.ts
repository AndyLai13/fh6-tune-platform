export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${salt}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function dailySalt(baseSalt: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `${baseSalt}|${day}`;
}
