import { useAirlineStore } from "@acars/store";
import { Link, useRouter } from "@tanstack/react-router";
import { Briefcase, Globe, Info, Plane, Radar, Trophy, Wallet } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavBadges } from "@/shared/hooks/useNavBadges";
import { NavBadge } from "./NavBadge";

type NavItem = {
  icon: typeof Radar;
  labelKey: string;
  mobileLabelKey: string;
  to: string;
  requiresAirline: boolean;
};

const navItems: NavItem[] = [
  {
    icon: Radar,
    labelKey: "nav.map",
    mobileLabelKey: "nav.mobileOps",
    to: "/",
    requiresAirline: false,
  },
  {
    icon: Plane,
    labelKey: "nav.fleet",
    mobileLabelKey: "nav.fleet",
    to: "/fleet",
    requiresAirline: true,
  },
  {
    icon: Globe,
    labelKey: "nav.network",
    mobileLabelKey: "nav.mobileNet",
    to: "/network",
    requiresAirline: true,
  },
  {
    icon: Trophy,
    labelKey: "nav.leaderboard",
    mobileLabelKey: "nav.mobileRank",
    to: "/leaderboard",
    requiresAirline: false,
  },
  {
    icon: Wallet,
    labelKey: "nav.corporate",
    mobileLabelKey: "nav.mobileCorp",
    to: "/corporate",
    requiresAirline: true,
  },
];

/** Resolve the badge to show for a given nav route path, given current badge counts. */
function resolveNavBadge(
  to: string,
  badges: ReturnType<typeof useNavBadges>,
): { count: number; variant: "gray" | "red" } | null {
  if (to === "/fleet") {
    if (badges.fleetUnassigned > 0) return { count: badges.fleetUnassigned, variant: "red" };
    if (badges.fleetTotal > 0) return { count: badges.fleetTotal, variant: "gray" };
    return null;
  }
  if (to === "/network") {
    if (badges.networkUnassigned > 0) return { count: badges.networkUnassigned, variant: "red" };
    if (badges.networkTotal > 0) return { count: badges.networkTotal, variant: "gray" };
    return null;
  }
  if (to === "/leaderboard") {
    if (badges.leaderboardRank > 0) return { count: badges.leaderboardRank, variant: "gray" };
    return null;
  }
  return null;
}

/** Preload all main route chunks once the shell mounts (idle time). */
function usePreloadNavRoutes() {
  const router = useRouter();
  useEffect(() => {
    const preloadAll = () => {
      for (const item of navItems) {
        void router.preloadRoute({ to: item.to });
      }
    };
    let cancel: (() => void) | null = null;
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preloadAll);
      cancel = () => {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(id);
        }
      };
    } else {
      const id = window.setTimeout(preloadAll, 1500);
      cancel = () => window.clearTimeout(id);
    }
    return () => cancel?.();
  }, [router]);
}

export function Sidebar() {
  // Primitive selector: the shell chrome re-renders only when the airline
  // context appears/disappears — not on every store set() (>=3 per tick).
  const hasAirlineContext = useAirlineStore((state) =>
    Boolean(state.airline || state.viewedPubkey),
  );
  const badges = useNavBadges();
  const { t } = useTranslation("common");
  usePreloadNavRoutes();

  return (
    <div className="pointer-events-auto hidden h-full w-16 flex-col border-r border-border bg-background/80 py-6 backdrop-blur-xl transition-all sm:flex md:w-52 md:px-2">
      <div className="flex flex-1 flex-col space-y-2">
        {navItems.map((item) => {
          const isDisabled = item.requiresAirline && !hasAirlineContext;
          const badge = resolveNavBadge(item.to, badges);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`group relative flex h-12 items-center justify-center rounded-xl transition-all md:justify-start md:gap-3 md:px-3 ${isDisabled ? "pointer-events-none opacity-40" : ""}`}
              activeProps={{
                className:
                  "bg-primary/20 text-primary shadow-[inset_0_0_15px_rgba(16,185,129,0.2)]",
              }}
              inactiveProps={{
                className: isDisabled
                  ? "text-muted-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              }}
            >
              <item.icon className="h-6 w-6" />
              {badge && <NavBadge count={badge.count} variant={badge.variant} />}
              <span className="absolute left-14 z-50 rounded-md bg-popover px-2 py-1 text-xs font-semibold text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 pointer-events-none whitespace-nowrap md:hidden">
                {t(item.labelKey)}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-sm font-semibold md:block">
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}

        <Link
          to="/about"
          className="group relative mt-auto flex h-12 items-center justify-center rounded-xl transition-all md:justify-start md:gap-3 md:px-3"
          activeProps={{
            className: "bg-primary/20 text-primary shadow-[inset_0_0_15px_rgba(16,185,129,0.2)]",
          }}
          inactiveProps={{
            className: "text-muted-foreground hover:bg-muted hover:text-foreground",
          }}
        >
          <Briefcase className="hidden h-6 w-6 md:block" />
          <Info className="h-6 w-6 md:hidden" />
          <span className="absolute left-14 z-50 rounded-md bg-popover px-2 py-1 text-xs font-semibold text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 pointer-events-none whitespace-nowrap md:hidden">
            {t("nav.about")}
          </span>
          <span className="hidden min-w-0 flex-1 truncate text-sm font-semibold md:block">
            {t("nav.about")}
          </span>
        </Link>
      </div>
    </div>
  );
}

export function MobileNav() {
  const hasAirlineContext = useAirlineStore((state) =>
    Boolean(state.airline || state.viewedPubkey),
  );
  const badges = useNavBadges();
  const { t } = useTranslation("common");

  return (
    <nav className="pointer-events-auto grid shrink-0 grid-cols-6 items-stretch border-t border-border bg-background/90 px-2 py-1.5 backdrop-blur-xl pb-[calc(0.375rem+env(safe-area-inset-bottom))] sm:hidden">
      {navItems.map((item) => {
        const isDisabled = item.requiresAirline && !hasAirlineContext;
        const badge = resolveNavBadge(item.to, badges);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 transition-all ${isDisabled ? "pointer-events-none opacity-40" : ""}`}
            activeProps={{
              className: "text-primary",
            }}
            inactiveProps={{
              className: isDisabled
                ? "text-muted-foreground"
                : "text-muted-foreground active:text-foreground",
            }}
          >
            <span className="relative">
              <item.icon className="h-5 w-5" />
              {badge && (
                <NavBadge
                  count={badge.count}
                  variant={badge.variant}
                  className="min-w-[14px] h-3.5 text-[8px]"
                />
              )}
            </span>
            <span className="text-center text-[8px] font-semibold uppercase tracking-[0.12em] leading-none">
              {t(item.mobileLabelKey)}
            </span>
          </Link>
        );
      })}
      <Link
        to="/about"
        className="flex min-w-0 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 transition-all"
        activeProps={{
          className: "text-primary",
        }}
        inactiveProps={{
          className: "text-muted-foreground active:text-foreground",
        }}
      >
        <span className="relative">
          <Info className="h-5 w-5" />
        </span>
        <span className="text-center text-[8px] font-semibold uppercase tracking-[0.12em] leading-none">
          {t("nav.info")}
        </span>
      </Link>
    </nav>
  );
}
