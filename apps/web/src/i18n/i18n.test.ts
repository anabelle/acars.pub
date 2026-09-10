import { afterEach, describe, expect, it, vi } from "vitest";
import i18n, {
  detectLanguage,
  initI18n,
  LANGUAGE_STORAGE_KEY,
  setLanguage,
  supportedLanguages,
} from "./index";

describe("i18n", () => {
  afterEach(async () => {
    // Reset to English after each test
    await i18n.changeLanguage("en");
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("initializes with English as fallback language", () => {
    expect(i18n.options.fallbackLng).toEqual(["en"]);
  });

  it("does not eagerly register non-English locales at init", () => {
    expect(i18n.hasResourceBundle("en", "common")).toBe(true);
    expect(i18n.hasResourceBundle("es", "common")).toBe(false);
  });

  it("loads English common namespace", () => {
    expect(i18n.t("nav.map", { ns: "common" })).toBe("Cockpit");
    expect(i18n.t("nav.fleet", { ns: "common" })).toBe("Fleet");
    expect(i18n.t("topbar.signIn", { ns: "common" })).toBe("Sign in");
  });

  it("loads English identity namespace", () => {
    expect(i18n.t("gate.connecting", { ns: "identity" })).toBe(
      "Establishing secure connection to Nostr network...",
    );
    expect(i18n.t("creator.title", { ns: "identity" })).toBe("Launch Your Airline");
  });

  it("loads English game namespace", () => {
    expect(i18n.t("leaderboard.fleetSize", { ns: "game" })).toBe("Fleet Size");
    expect(i18n.t("flightBoard.departures", { ns: "game" })).toBe("Departures");
    expect(i18n.t("corporate.pageTitle", { ns: "game" })).toBe("Corporate");
    expect(i18n.t("routeManager.suspended.title", { ns: "game" })).toBe("Suspended Routes");
    expect(i18n.t("fleet.searchPlaceholder", { ns: "game" })).toBe("Search active fleet…");
    expect(i18n.t("fleet.purchaseUsedTitle", { ns: "game" })).toBe("Purchase used aircraft?");
    expect(i18n.t("airportPanel.openHubConfirm", { ns: "game" })).toBe("Open Hub");
    expect(i18n.t("aircraftPanel.title", { ns: "game" })).toBe("Aircraft");
    expect(i18n.t("corporate.hubContractReview", { ns: "game" })).toBe("Hub Contract Review");
  });

  it("switches to Spanish", async () => {
    await i18n.changeLanguage("es");
    expect(i18n.language).toBe("es");
    expect(i18n.t("nav.map", { ns: "common" })).toBe("Cabina");
    expect(i18n.t("nav.fleet", { ns: "common" })).toBe("Flota");
    expect(i18n.t("topbar.signIn", { ns: "common" })).toBe("Iniciar sesión");
  });

  it("loads Spanish identity namespace", async () => {
    await i18n.changeLanguage("es");
    expect(i18n.t("creator.title", { ns: "identity" })).toBe("Lanza Tu Aerolínea");
    expect(i18n.t("guest.playFree", { ns: "identity" })).toBe(
      "Juega gratis — sin registro requerido",
    );
    expect(i18n.t("access.corporateLockedTitle", { ns: "identity" })).toBe(
      "Acceso corporativo bloqueado",
    );
  });

  it("loads Spanish common and game additions for interface flows", async () => {
    await i18n.changeLanguage("es");
    expect(i18n.t("panel.closeAria", { ns: "common" })).toBe("Cerrar panel y volver a cabina");
    expect(i18n.t("actions.cancel", { ns: "common" })).toBe("Cancelar");
    expect(i18n.t("topbar.openPanel", { ns: "common", panel: "cabina de vuelo" })).toBe(
      "Abrir cabina de vuelo",
    );
    expect(i18n.t("join.features.realTimeFlights.title", { ns: "common" })).toBe(
      "Vuelos en tiempo real",
    );
    expect(i18n.t("hubPicker.dialogTitle", { ns: "game" })).toBe("Elegir un aeropuerto hub");
    expect(i18n.t("fleet.searchPlaceholder", { ns: "game" })).toBe("Buscar flota activa…");
    expect(i18n.t("fleet.purchaseUsedTitle", { ns: "game" })).toBe("¿Comprar aeronave usada?");
    expect(i18n.t("airportPanel.openHubConfirm", { ns: "game" })).toBe("Abrir hub");
    expect(i18n.t("aircraftPanel.title", { ns: "game" })).toBe("Aeronave");
    expect(i18n.t("corporate.hubContractReview", { ns: "game" })).toBe(
      "Revisión del contrato del hub",
    );
    expect(i18n.t("backup.localKeyAccessFailed", { ns: "identity" })).toBe(
      "No se pudo acceder a tu clave de cuenta almacenada localmente.",
    );
  });

  it("falls back to English for unsupported language", async () => {
    await i18n.changeLanguage("xx");
    expect(i18n.t("nav.map", { ns: "common" })).toBe("Cockpit");
  });

  it("handles interpolation", () => {
    expect(i18n.t("topbar.relaysOnline", { ns: "common", count: 3 })).toBe("3 relays online");
    expect(i18n.t("topbar.relaysOnline", { ns: "common", count: 1 })).toBe("1 relay online");
  });

  it("updates HTML lang attribute on language change", async () => {
    await i18n.changeLanguage("es");
    expect(document.documentElement.lang).toBe("es");
    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("has all supported languages defined", () => {
    const supportedLngs = i18n.options.supportedLngs;
    expect(supportedLngs).toContain("en");
    expect(supportedLngs).toContain("es");
  });
});

describe("i18n lazy loading", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads Spanish bundles through the lazy backend on changeLanguage", async () => {
    await i18n.changeLanguage("es");
    expect(i18n.hasResourceBundle("es", "common")).toBe(true);
    expect(i18n.hasResourceBundle("es", "game")).toBe(true);
    expect(i18n.t("nav.map", { ns: "common" })).toBe("Cabina");
  });
});

describe("detectLanguage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("prefers the stored manual override", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "es");
    expect(detectLanguage()).toBe("es");
  });

  it("ignores unsupported stored values", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    expect(detectLanguage()).toBe("en");
  });

  it("falls back to the browser language", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-AR");
    expect(detectLanguage()).toBe("es");
  });

  it("falls back to English for unsupported browser languages", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("fr-FR");
    expect(detectLanguage()).toBe("en");
  });
});

describe("setLanguage", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads the locale and persists the explicit choice", async () => {
    await setLanguage("es");
    expect(i18n.language).toBe("es");
    expect(i18n.t("nav.map", { ns: "common" })).toBe("Cabina");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("es");
  });

  it("supports switching back and forth without re-registration issues", async () => {
    await setLanguage("es");
    await setLanguage("en");
    expect(i18n.t("nav.map", { ns: "common" })).toBe("Cockpit");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });

  it("auto clears the stored override and follows the browser language", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("es-ES");
    await setLanguage("auto");
    expect(i18n.language).toBe("es");
    expect(i18n.t("nav.map", { ns: "common" })).toBe("Cabina");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
  });
});

describe("initI18n", () => {
  it("is idempotent and returns the initialized instance", async () => {
    const instance = await initI18n();
    expect(instance).toBe(i18n);
    expect(i18n.isInitialized).toBe(true);
    await expect(initI18n()).resolves.toBe(i18n);
  });
});

describe("supportedLanguages export", () => {
  it("matches the languages the app advertises", () => {
    expect(Object.keys(supportedLanguages)).toEqual(["en", "es"]);
  });
});
