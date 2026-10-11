// Cockpit + Ramp (S59.2): the stock palette names the components already use
// keep their meaning, but resolve to the avionics colours (one colour, one job):
// emerald/green = normal, rose/red = warning, amber/orange/yellow = caution,
// sky/blue/cyan = selection, violet/purple/fuchsia/indigo = active leg,
// slate/zinc/gray/neutral = cockpit greys. 500 is the token itself; lighter
// steps mix toward white, darker steps toward the cockpit background.
const COCKPIT_BG = "#06080B";
function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa
    .map((c, i) =>
      Math.round(c + (pb[i] - c) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
function scale(base) {
  return {
    50: mix(base, "#FFFFFF", 0.9),
    100: mix(base, "#FFFFFF", 0.78),
    200: mix(base, "#FFFFFF", 0.6),
    300: mix(base, "#FFFFFF", 0.4),
    400: mix(base, "#FFFFFF", 0.18),
    500: base,
    600: mix(base, COCKPIT_BG, 0.2),
    700: mix(base, COCKPIT_BG, 0.4),
    800: mix(base, COCKPIT_BG, 0.6),
    900: mix(base, COCKPIT_BG, 0.75),
    950: mix(base, COCKPIT_BG, 0.86),
  };
}
const greys = {
  50: "#F2F4F5",
  100: "#E1E5E8",
  200: "#C7CDD3",
  300: "#A6AFB8",
  400: "#8A949E",
  500: "#6B7580",
  600: "#4A535D",
  700: "#2A323C",
  800: "#161B21",
  900: "#0B0E12",
  950: "#06080B",
};
const ND_GREEN = scale("#3EDC81");
const ND_RED = scale("#FF3B30");
const ND_AMBER = scale("#FFB000");
const ND_CYAN = scale("#3CD2F0");
const ND_MAGENTA = scale("#E040FB");
const avionicsPalette = {
  emerald: ND_GREEN,
  green: ND_GREEN,
  teal: ND_GREEN,
  lime: ND_GREEN,
  rose: ND_RED,
  red: ND_RED,
  pink: ND_RED,
  amber: ND_AMBER,
  orange: ND_AMBER,
  yellow: ND_AMBER,
  sky: ND_CYAN,
  blue: ND_CYAN,
  cyan: ND_CYAN,
  violet: ND_MAGENTA,
  purple: ND_MAGENTA,
  fuchsia: ND_MAGENTA,
  indigo: ND_MAGENTA,
  slate: greys,
  zinc: greys,
  gray: greys,
  neutral: greys,
  stone: greys,
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Cockpit + Ramp type (S59): B612 for text and data, Overpass caps for signs.
        sans: ['"B612"', "ui-sans-serif", "system-ui", "sans-serif"],
        // Figures read in proportional B612 with tabular digits: B612 Mono gives
        // punctuation a full cell ("$92, 650. 00"). Codes use font-avionics-mono.
        mono: ['"B612"', "ui-sans-serif", "system-ui", "sans-serif"],
        avionics: ['"B612"', "ui-sans-serif", "system-ui", "sans-serif"],
        "avionics-mono": ['"B612 Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        sign: ['"Overpass"', '"B612"', "ui-sans-serif", "sans-serif"],
      },
      colors: {
        ...avionicsPalette,
        cockpit: {
          bg: "rgb(var(--cockpit-bg) / <alpha-value>)",
          panel: "rgb(var(--cockpit-panel) / <alpha-value>)",
          line: "rgb(var(--cockpit-line) / <alpha-value>)",
        },
        nd: {
          magenta: "rgb(var(--nd-magenta) / <alpha-value>)",
          cyan: "rgb(var(--nd-cyan) / <alpha-value>)",
          green: "rgb(var(--nd-green) / <alpha-value>)",
          amber: "rgb(var(--nd-amber) / <alpha-value>)",
          red: "rgb(var(--nd-red) / <alpha-value>)",
          white: "rgb(var(--nd-white) / <alpha-value>)",
        },
        ramp: {
          asphalt: "rgb(var(--ramp-asphalt) / <alpha-value>)",
          slab: "rgb(var(--ramp-slab) / <alpha-value>)",
          paint: "rgb(var(--ramp-paint) / <alpha-value>)",
        },
        sign: {
          yellow: "rgb(var(--sign-yellow) / <alpha-value>)",
          black: "rgb(var(--sign-black) / <alpha-value>)",
          red: "rgb(var(--sign-red) / <alpha-value>)",
        },
        "hi-vis": "rgb(var(--hi-vis) / <alpha-value>)",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
