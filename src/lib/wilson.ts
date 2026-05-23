const Z = 1.96;

export function wilsonScore(ratingSum: number, ratingCount: number): number {
  if (ratingCount <= 0) return 0;
  const phat = ratingSum / (ratingCount * 5);
  const n = ratingCount;
  const z2 = Z * Z;
  const num = phat + z2 / (2 * n) - Z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  const den = 1 + z2 / n;
  return num / den;
}
