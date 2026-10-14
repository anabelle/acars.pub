import { ExternalLink, Globe, Plane, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/shared/components/layout/LanguageSelector";
import { PanelBody, PanelHeader, PanelLayout } from "@/shared/components/layout/PanelLayout";

const GITHUB_URL = "https://github.com/anabelle/acars.pub";

/** The GitHub mark (lucide-react 1.x dropped brand icons). */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const highlightKeys = [
  { icon: Globe, titleKey: "nostr.title", descKey: "nostr.desc" },
  { icon: Plane, titleKey: "realtime.title", descKey: "realtime.desc" },
  { icon: Zap, titleKey: "bitcoin.title", descKey: "bitcoin.desc" },
];

export default function AboutPage() {
  const { t } = useTranslation("about");
  const { t: tc } = useTranslation("common");

  return (
    <PanelLayout>
      <PanelHeader title={t("title")} subtitle={t("subtitle")} />
      <PanelBody className="space-y-6 pt-3 sm:pt-4">
        {/* How to play first (S78): what a new player came here for. */}
        <section data-testid="how-to-play" className="space-y-3">
          <h2 className="text-lg font-black tracking-tight text-foreground">{t("howTo.title")}</h2>
          <ol className="space-y-2">
            {(t("howTo.steps", { returnObjects: true }) as string[]).map((step, index) => (
              <li
                key={step}
                className="flex gap-3 rounded-xl border border-border/60 bg-background/95 p-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section data-testid="glossary" className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {t("glossary.title")}
          </h2>
          <dl className="space-y-2 text-sm">
            {(t("glossary.items", { returnObjects: true }) as [string, string][]).map(
              ([term, meaning]) => (
                <div key={term}>
                  <dt className="font-semibold text-foreground">{term}</dt>
                  <dd className="text-xs leading-relaxed text-muted-foreground">{meaning}</dd>
                </div>
              ),
            )}
          </dl>
        </section>

        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t("aboutTitle")}
        </h2>
        {/* Description */}
        <section className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">{t("acarsTitle")}</strong> {t("acarsDesc")}
          </p>
        </section>

        {/* Highlights */}
        <section className="space-y-3">
          {highlightKeys.map((item) => (
            <div
              key={item.titleKey}
              className="flex gap-3 rounded-xl border border-border/60 bg-background/95 p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{t(item.titleKey)}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {t(item.descKey)}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Language Selector */}
        <section className="flex items-center justify-between rounded-xl border border-border/60 bg-background/95 px-4 py-3">
          <span className="text-sm font-medium text-foreground">{tc("language.label")}</span>
          <LanguageSelector />
        </section>

        {/* Links */}
        <section className="space-y-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <GithubMark className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex-1">{t("viewOnGithub")}</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
          <a
            href="https://nostr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <Globe className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex-1">{t("learnNostr")}</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
        </section>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/60">{t("license")}</p>
      </PanelBody>
    </PanelLayout>
  );
}
