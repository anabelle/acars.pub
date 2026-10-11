/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Cockpit + Ramp type (S59): B612 for text and data, Overpass caps for signs.
        avionics: ['"B612"', "ui-sans-serif", "system-ui", "sans-serif"],
        "avionics-mono": ['"B612 Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        sign: ['"Overpass"', '"B612"', "ui-sans-serif", "sans-serif"],
      },
      colors: {
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
