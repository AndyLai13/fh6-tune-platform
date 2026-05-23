export function makeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function randomSuffix(len = 6): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function makeTuneSlug(name: string, carSlug: string): string {
  const nameSlug = makeSlug(name) || 'tune';
  return `${nameSlug}-${carSlug}-${randomSuffix()}`.slice(0, 120);
}
