import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// English is bundled statically: it is the fallback language and must always
// be available without any network/module fetch.
import enAbout from "./locales/en/about.json";
import enCommon from "./locales/en/common.json";
import enGame from "./locales/en/game.json";
import enIdentity from "./locales/en/identity.json";

/** Languages supported by the app. */
export const supportedLanguages = {
  en: "English",
  es: "Español",
} as const;

export type SupportedLanguage = keyof typeof supportedLanguages;

/** localStorage key holding the user's manual language override. */
export const LANGUAGE_STORAGE_KEY = "acars-language";

const NAMESPACES = ["common", "identity", "game", "about"] as const;
type Namespace = (typeof NAMESPACES)[number];

type LocaleBundles = Record<Namespace, unknown>;

const en: LocaleBundles = {
  common: enCommon,
  identity: enIdentity,
  game: enGame,
  about: enAbout,
};

/**
 * Lazy loaders per language. English resolves from the statically bundled
 * JSON (instant, no extra chunk); every other language is code-split via
 * dynamic import so it stays out of the entry bundle until requested.
 */
const localeLoaders: Record<SupportedLanguage, () => Promise<LocaleBundles>> = {
  en: () => Promise.resolve(en),
  es: async () => ({
    common: (await import("./locales/es/common.json")).default,
    identity: (await import("./locales/es/identity.json")).default,
    game: (await import("./locales/es/game.json")).default,
    about: (await import("./locales/es/about.json")).default,
  }),
};

/**
 * Minimal i18next backend that serves locales from lazy chunks. Wiring the
 * loaders as a backend (instead of pre-registering resources) means
 * `i18n.init` and `i18n.changeLanguage` transparently await the dynamic
 * imports before resolving — no Suspense or flash-of-fallback needed.
 */
const lazyLocaleBackend = {
  type: "backend" as const,
  init() {},
  read(language: string, namespace: string, callback: (err: unknown, data?: unknown) => void) {
    const loader = localeLoaders[language as SupportedLanguage];
    if (!loader || !NAMESPACES.includes(namespace as Namespace)) {
      callback(new Error(`No locale bundle for ${language}/${namespace}`));
      return;
    }
    loader()
      .then((bundles) => callback(null, bundles[namespace as Namespace]))
      .catch((err) => callback(err));
  },
};

function readStoredLanguage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLanguage(lng: SupportedLanguage) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // Ignore storage access failures; the choice just won't persist.
  }
}

function clearStoredLanguage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Ignore storage access failures.
  }
}

function isSupported(lng: string | null | undefined): lng is SupportedLanguage {
  return !!lng && Object.prototype.hasOwnProperty.call(supportedLanguages, lng);
}

function languageFromNavigator(): SupportedLanguage {
  if (typeof navigator === "undefined") return "en";
  const base = navigator.language?.split("-")[0];
  return isSupported(base) ? base : "en";
}

/**
 * Resolve the initial language: manual override (localStorage) first, then
 * browser preferences, then English. Replaces i18next-browser-languagedetector.
 */
export function detectLanguage(): SupportedLanguage {
  const stored = readStoredLanguage();
  if (isSupported(stored)) return stored;
  return languageFromNavigator();
}

let initPromise: Promise<typeof i18n> | null = null;

/**
 * Initialize i18n with only the detected locale loaded. Idempotent: calling
 * it again (tests, HMR) reuses the same initialization promise.
 */
export function initI18n(): Promise<typeof i18n> {
  if (!initPromise) {
    initPromise = (async () => {
      await i18n
        .use(lazyLocaleBackend)
        .use(initReactI18next)
        .init({
          lng: detectLanguage(),
          fallbackLng: "en",
          supportedLngs: Object.keys(supportedLanguages),
          defaultNS: "common",
          ns: [...NAMESPACES],
          interpolation: {
            escapeValue: false, // React already escapes
          },
          react: {
            useSuspense: false,
          },
        });
      return i18n;
    })();
  }
  return initPromise;
}

/**
 * Change the app language, loading the target locale's bundles first (via
 * the lazy backend) and persisting the choice. Pass "auto" to clear the
 * stored override and follow the browser language.
 */
export async function setLanguage(lng: SupportedLanguage | "auto"): Promise<void> {
  const target = lng === "auto" ? languageFromNavigator() : lng;
  if (lng === "auto") {
    clearStoredLanguage();
  } else {
    storeLanguage(lng);
  }
  await i18n.changeLanguage(target);
}

/**
 * Keep the <html lang> attribute in sync with the current language.
 * This is necessary for accessibility (screen readers use it to determine
 * pronunciation rules) and for CSS :lang() selectors.
 */
function syncHtmlLang(lng: string) {
  const lang = lng.split("-")[0]; // "en-US" → "en"
  document.documentElement.lang = lang;
}

i18n.on("languageChanged", syncHtmlLang);

export default i18n;
