import { useAirlineStore } from "@acars/store";
import { useNavigate } from "@tanstack/react-router";
import { Clock, Globe, Map as MapIcon, Plane, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { GuestKeyOnboarding } from "@/features/identity/components/GuestKeyOnboarding";

export default function JoinPage() {
  const { t } = useTranslation(["common", "identity"]);
  const identityStatus = useAirlineStore((state) => state.identityStatus);
  const navigate = useNavigate();

  const features = useMemo(
    () => [
      {
        icon: Clock,
        title: t("join.features.realTimeFlights.title", { ns: "common" }),
        description: t("join.features.realTimeFlights.description", { ns: "common" }),
      },
      {
        icon: MapIcon,
        title: t("join.features.network.title", { ns: "common" }),
        description: t("join.features.network.description", { ns: "common" }),
      },
      {
        icon: Plane,
        title: t("join.features.fleet.title", { ns: "common" }),
        description: t("join.features.fleet.description", { ns: "common" }),
      },
      {
        icon: ShieldCheck,
        title: t("join.features.decentralized.title", { ns: "common" }),
        description: t("join.features.decentralized.description", { ns: "common" }),
      },
      {
        icon: Users,
        title: t("join.features.competition.title", { ns: "common" }),
        description: t("join.features.competition.description", { ns: "common" }),
      },
    ],
    [t],
  );

  // Planned features, shown separately and labelled as such so the landing
  // page never presents unshipped mechanics as live (overhaul S20.4).
  const roadmap = useMemo(
    () =>
      (["company", "bitcoin", "alliances"] as const).map((key) => ({
        key,
        title: t(`join.roadmap.items.${key}.title`, { ns: "common" }),
        description: t(`join.roadmap.items.${key}.description`, { ns: "common" }),
      })),
    [t],
  );

  // Redirect to app once identity exists so users cannot overwrite
  // a freshly generated local account by re-triggering onboarding.
  useEffect(() => {
    if (identityStatus === "ready") {
      void navigate({ to: "/" });
    }
  }, [identityStatus, navigate]);

  function handleExistingAccount() {
    void navigate({ to: "/" });
  }

  return (
    <div className="pointer-events-auto relative flex min-h-screen w-full flex-col overflow-auto bg-background/95 backdrop-blur-2xl">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/60 bg-background/80 px-6 py-4 backdrop-blur-xl">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/20 text-xs font-bold text-primary">
          AT
        </div>
        <div>
          <h1 className="text-sm font-bold leading-none tracking-tight text-foreground">
            {t("topbar.acars", { ns: "common" })}
          </h1>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            {t("topbar.acarsLong", { ns: "common" })}
          </p>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-12">
        <section className="flex flex-col items-start gap-8 lg:flex-row lg:items-center">
          {/* Pitch */}
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Plane className="h-3 w-3" />
              {t("join.badge", { ns: "common" })}
            </div>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
              {t("join.heroTitleLineOne", { ns: "common" })} <br />
              {t("join.heroTitleLineTwo", { ns: "common" })}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("join.heroDescription", { ns: "common" })}
            </p>
          </div>

          {/* Onboarding card */}
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background/60 p-6 shadow-2xl backdrop-blur-xl">
            <GuestKeyOnboarding onExistingAccount={handleExistingAccount} />
          </div>
        </section>

        {/* Feature grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex gap-3 rounded-xl border border-border/50 bg-background/50 p-4 backdrop-blur-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Roadmap: planned, not shipped */}
        <section
          aria-labelledby="join-roadmap-title"
          className="rounded-xl border border-dashed border-border/60 bg-background/30 p-4"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 id="join-roadmap-title" className="text-sm font-semibold text-foreground">
              <Globe className="mr-1.5 inline h-4 w-4 align-[-2px] text-muted-foreground" />
              {t("join.roadmap.title", { ns: "common" })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("join.roadmap.subtitle", { ns: "common" })}
            </p>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {roadmap.map((item) => (
              <li key={item.key} className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground/80">{item.title}</span>
                {" — "}
                {item.description}
              </li>
            ))}
          </ul>
        </section>

        {/* Footer note */}
        <p className="text-center text-[11px] text-muted-foreground/50">
          {t("join.footer", { ns: "common" })}
        </p>
      </main>
    </div>
  );
}
