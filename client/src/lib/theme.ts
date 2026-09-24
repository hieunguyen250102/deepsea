/**
 * Colour vocabulary. Matte, picture-book tones: sand-paper panels over a sea
 * that darkens with depth. Treasure warms up as it gets deeper and richer.
 */

export const INK = '#13293a';
export const SAND = '#f5ecd9';
export const FOAM = '#e9f3ef';

/** Diver colours, in the order of the six docks on the submarine. */
export const DIVER_COLORS = [
  { name: 'Đỏ', body: '#e0574b', shade: '#b7413a', light: '#f3a79c' },
  { name: 'Xanh dương', body: '#2f7fc0', shade: '#235f93', light: '#8fc0e6' },
  { name: 'Vàng', body: '#eec23f', shade: '#c79a22', light: '#f8e39d' },
  { name: 'Xanh lá', body: '#3f9c6d', shade: '#2d7652', light: '#9dd3b4' },
  { name: 'Cam', body: '#ea8a37', shade: '#c06a22', light: '#f7c395' },
  { name: 'Tím', body: '#8c62c2', shade: '#6a4697', light: '#cbb4e6' },
] as const;

export function diverColor(i: number) {
  return DIVER_COLORS[((i % 6) + 6) % 6];
}

/** Treasure levels: shape, colours and the number of dots on the hidden side. */
export const LEVELS = {
  1: { sides: 3, fill: '#a6dccb', rim: '#6fb8a2', label: 'Tam giác', range: '0–3' },
  2: { sides: 4, fill: '#7ebfdc', rim: '#4f97b8', label: 'Vuông', range: '4–7' },
  3: { sides: 5, fill: '#ecbc62', rim: '#c8923a', label: 'Ngũ giác', range: '8–11' },
  4: { sides: 6, fill: '#e58468', rim: '#bf5d44', label: 'Lục giác', range: '12–15' },
} as const;

/** Air track colours, as on the submarine board: calm, then warning, then danger. */
export function airColor(n: number): string {
  if (n >= 13) return '#86d3c4';
  if (n >= 6) return '#eec05a';
  return '#e8715f';
}
