export const clamp = (n: number, min: number, max: number): number =>
  Math.max(Math.min(n, max), min)

export const toFixed = (n: number, d: number): string =>
  n.toFixed(d).replace(/\.?0+$/, '')
