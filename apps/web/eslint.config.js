import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      // Pin the root so one lint run over web and package files (the
      // pre-commit hook) isn't ambiguous between the two configs.
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      globals: globals.browser,
    },
  },
  {
    // No hard-coded copy in the network screens (overhaul S24.4): every
    // visible string goes through i18n (en + es). Tests are exempt.
    files: ["src/features/network/components/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // Unit symbols (km, kg, ft, UTC) and one-letter codes (the x in
          // 1.2x, fare classes Y/J/F, m, h) are not copy.
          selector: "JSXText[value=/(?<![A-Za-z])(?!(?:km|kg|ft|UTC)(?![A-Za-z]))[A-Za-z]{2,}/]",
          message: "Visible text must come from i18n (t(...)), not a literal.",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|title|placeholder|alt)$/] > Literal[value=/[A-Za-z]/]",
          message: "Accessible and tooltip text must come from i18n (t(...)), not a literal.",
        },
      ],
    },
  },
  {
    // Playwright specs run in Node; fixtures call Playwright's `use()`, which
    // the React hooks rule mistakes for React's `use` hook.
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);
