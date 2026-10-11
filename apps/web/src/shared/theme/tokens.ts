/**
 * Cockpit + Ramp colour tokens (S59, Blueprint v2 §8). The same values live as
 * CSS variables in `src/index.css` (tested to match); use these where CSS
 * cannot reach, such as MapLibre paint properties and canvas drawing.
 */
export const COCKPIT = {
  bg: "#06080B",
  panel: "#0B0E12",
  line: "#2A323C",
} as const;

/** Navigation-display colours: each has one job, as in real avionics. */
export const ND = {
  /** Active leg. */
  magenta: "#E040FB",
  /** The player's input or selection. */
  cyan: "#3CD2F0",
  /** Normal. */
  green: "#3EDC81",
  /** Caution. */
  amber: "#FFB000",
  /** Warning. */
  red: "#FF3B30",
  /** Data. */
  white: "#F2F4F5",
} as const;

export const RAMP = {
  asphalt: "#2B2D30",
  slab: "#383B3F",
  paint: "#ECE8DF",
} as const;

export const SIGN = {
  yellow: "#F2C230",
  black: "#141414",
  red: "#C8102E",
} as const;

/** Idle planes, urgent actions. */
export const HI_VIS = "#FF7A1A";

/** WCAG relative luminance of a `#RRGGBB` colour. */
export function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#RRGGBB` colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
