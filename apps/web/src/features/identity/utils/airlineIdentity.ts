/**
 * Defaults for a new airline derived from its name (S21), so the creator
 * needs only a name and a hub. Every value stays editable under "Customize".
 * Pure and deterministic.
 */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Upper-case A–Z words of a name, accents stripped ("Aérea Ñandú" → AEREA, NANDU). */
function nameWords(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Candidate 3-letter codes for a name, most natural first. */
function icaoCandidates(words: string[]): string[] {
  const joined = words.join("");
  const candidates: string[] = [];
  const push = (code: string) => {
    if (code.length === 3 && !candidates.includes(code)) candidates.push(code);
  };
  if (words.length >= 3) push(words[0][0] + words[1][0] + words[2][0]);
  if (words.length >= 2) {
    push(words[0][0] + words[1].slice(0, 2));
    push(words[0].slice(0, 2) + words[1][0]);
  }
  push(joined.slice(0, 3));
  // First letter plus any two later letters, in order.
  for (let i = 1; i < joined.length; i += 1) {
    for (let j = i + 1; j < joined.length; j += 1) push(joined[0] + joined[i] + joined[j]);
  }
  return candidates;
}

/** A 3-letter ICAO-style code for `name` that no one in `taken` uses. */
export function suggestIcaoCode(name: string, taken: ReadonlySet<string>): string {
  const words = nameWords(name);
  for (const code of icaoCandidates(words)) {
    if (!taken.has(code)) return code;
  }
  // Every natural code is taken: walk all codes from a name-seeded start.
  const total = LETTERS.length ** 3;
  const start = hashString(words.join(" ") || "airline") % total;
  for (let step = 0; step < total; step += 1) {
    const index = (start + step) % total;
    const code =
      LETTERS[Math.floor(index / 676)] + LETTERS[Math.floor(index / 26) % 26] + LETTERS[index % 26];
    if (!taken.has(code)) return code;
  }
  return "XXX";
}

/** The radio callsign: the name's first word ("Iberia Express" → IBERIA), else the code. */
export function suggestCallsign(name: string, icaoCode: string): string {
  const first = nameWords(name)[0];
  return first ? first.slice(0, 12) : icaoCode;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const value = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** Livery colours from the name: a deep primary and a bright complementary accent. */
export function suggestLivery(name: string): { primary: string; secondary: string } {
  const hue = hashString(nameWords(name).join(" ") || "airline") % 360;
  return {
    primary: hslToHex(hue, 55, 22),
    secondary: hslToHex((hue + 150) % 360, 70, 45),
  };
}
