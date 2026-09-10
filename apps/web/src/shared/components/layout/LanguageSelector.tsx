import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  LANGUAGE_STORAGE_KEY,
  setLanguage,
  supportedLanguages,
  type SupportedLanguage,
} from "@/i18n";

function safeGetStoredLanguage(): string | null {
  if (typeof window === "undefined") return null;
  const storage = window.localStorage;
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    return storage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function LanguageSelector() {
  const { t } = useTranslation("common");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value !== "auto" && !(value in supportedLanguages)) return;
    // Loads the locale's lazy bundles (if needed) and applies the change
    void setLanguage(value as SupportedLanguage | "auto");
  };

  // Check if a manual override is stored
  const storedLang = safeGetStoredLanguage();
  const currentValue = storedLang ?? "auto";

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
      <label htmlFor="language-select" className="sr-only">
        {t("language.label")}
      </label>
      <select
        id="language-select"
        value={currentValue}
        onChange={handleChange}
        className="min-h-9 rounded-md border border-border bg-background/70 px-2 py-1 text-sm text-foreground focus:border-primary/60 focus:outline-none"
      >
        <option value="auto">{t("language.auto")}</option>
        {Object.entries(supportedLanguages).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
