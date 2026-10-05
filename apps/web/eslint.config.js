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
