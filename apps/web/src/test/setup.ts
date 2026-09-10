import "@testing-library/jest-dom/vitest";
// Initialize i18n for tests: English-only init, synchronous-fast (the lazy
// backend serves the statically bundled English JSON without network).
import { initI18n } from "../i18n";

await initI18n();
