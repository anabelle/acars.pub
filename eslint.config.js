import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "dist",
    "node_modules",
    "apps/**/dist",
    "packages/**/dist",
    "apps/web/android/**/build/**",
  ]),
  {
    files: ["packages/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      // Pin the root so one lint run over web and package files (the
      // pre-commit hook) isn't ambiguous between the two configs.
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ["packages/**/src/**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["packages/store/src/slices/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["packages/data/src/**/*.ts"],
    rules: {
      "no-loss-of-precision": "off",
    },
  },
]);
