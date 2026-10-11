import { COCKPIT, contrastRatio, ND } from "./tokens";

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * An airline colour that reads on the cockpit background (S60): the primary
 * when it has 3:1 contrast, else the secondary, else the active-leg magenta.
 * Liveries are the players' own; dark navy is common and would vanish.
 */
export function legibleLiveryColour(primary?: string, secondary?: string): string {
  for (const colour of [primary, secondary]) {
    if (colour && HEX.test(colour) && contrastRatio(colour, COCKPIT.bg) >= 3) return colour;
  }
  return ND.magenta;
}

/** "ATR 42-600", not "ATR ATR 42-600": model names often repeat the maker. */
export function modelLabel(manufacturer: string, name: string): string {
  return name.toLowerCase().startsWith(manufacturer.toLowerCase())
    ? name
    : `${manufacturer} ${name}`;
}
