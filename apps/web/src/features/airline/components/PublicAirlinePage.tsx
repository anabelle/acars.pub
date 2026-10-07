import type { AirlineEntity, Route } from "@acars/core";
import { fpFormat } from "@acars/core";
import { getAircraftById, getAirports } from "@acars/data";
import { useAirlineStore } from "@acars/store";
import { Link } from "@tanstack/react-router";
import { Plane, Route as RouteIcon, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { airlinePath } from "@/features/airline/utils/airlineKey";
import { projectRouteMap } from "@/features/airline/utils/routeMap";
import { ShareNetworkButton } from "@/features/share/ShareNetworkButton";
import { LiveryThumb } from "@/shared/components/LiveryThumb";

const MAP = { width: 560, height: 260, padding: 24 };

function RouteMap({ airline, routes }: { airline: AirlineEntity; routes: readonly Route[] }) {
  const geometry = useMemo(() => {
    const byIata = new Map(getAirports().map((a) => [a.iata, a]));
    return projectRouteMap(
      routes.filter((route) => route.status === "active"),
      (iata) => byIata.get(iata),
      { ...MAP, hubs: airline.hubs },
    );
  }, [airline.hubs, routes]);
  return (
    <svg
      viewBox={`0 0 ${MAP.width} ${MAP.height}`}
      className="h-auto w-full rounded-2xl border border-border/50 bg-[#0b1020]"
      role="img"
      aria-label={`${airline.name} route map`}
      data-testid="airline-route-map"
    >
      {geometry.lines.map((line, i) => (
        <line
          // biome-ignore lint/suspicious/noArrayIndexKey: geometry is positional
          key={i}
          {...line}
          stroke="#38bdf8"
          strokeWidth={2}
          strokeOpacity={0.85}
        />
      ))}
      {geometry.points.map((point) => (
        <g key={point.iata}>
          <circle
            cx={point.x}
            cy={point.y}
            r={point.hub ? 6 : 3.5}
            fill={point.hub ? airline.livery.accent : "#e2e8f0"}
          />
          <text x={point.x + 8} y={point.y + 4} fontSize={11} fill="#cbd5e1" fontFamily="monospace">
            {point.iata}
          </text>
        </g>
      ))}
    </svg>
  );
}

type Lookup = "own" | "found" | "loading" | "missing";

/**
 * Public airline page (S50): anyone, signed in or not, can open
 * `/airline/<npub>` and see the airline's liveries, route map and stats.
 */
export function PublicAirlinePage({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation("game");
  const myPubkey = useAirlineStore((s) => s.pubkey);
  const myAirline = useAirlineStore((s) => s.airline);
  const myRoutes = useAirlineStore((s) => s.routes);
  const myFleet = useAirlineStore((s) => s.fleet);
  const rival = useAirlineStore((s) => s.competitors.get(pubkey));
  const rivalRoutes = useAirlineStore((s) => s.routesByOwner.get(pubkey));
  const rivalFleet = useAirlineStore((s) => s.fleetByOwner.get(pubkey));
  const syncCompetitor = useAirlineStore((s) => s.syncCompetitor);
  const isMine = myPubkey === pubkey && !!myAirline;
  const [synced, setSynced] = useState<string | null>(null);

  useEffect(() => {
    if (isMine || rival) return;
    let cancelled = false;
    void syncCompetitor(pubkey)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSynced(pubkey);
      });
    return () => {
      cancelled = true;
    };
  }, [isMine, rival, pubkey, syncCompetitor]);

  const airline = isMine ? myAirline : (rival ?? null);
  const routes = (isMine ? myRoutes : rivalRoutes) ?? [];
  const fleet = (isMine ? myFleet : rivalFleet) ?? [];
  const lookup: Lookup = isMine
    ? "own"
    : airline
      ? "found"
      : synced === pubkey
        ? "missing"
        : "loading";

  if (!airline) {
    return (
      <div
        className="flex flex-col items-center gap-3 py-16 text-center"
        data-testid="public-airline-status"
      >
        <Plane className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {lookup === "loading" ? t("publicAirline.loading") : t("publicAirline.notFound")}
        </p>
        <Link
          to="/join"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          {t("publicAirline.cta")}
        </Link>
      </div>
    );
  }

  const activeRoutes = routes.filter((route) => route.status === "active");
  const liveried = [...fleet].sort(
    (a, b) => Number(!!b.liveryImageUrl) - Number(!!a.liveryImageUrl),
  );
  const share = async () => {
    const url = `${window.location.origin}${airlinePath(pubkey)}`;
    try {
      if (navigator.share) await navigator.share({ title: airline.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("publicAirline.linkCopied"));
      }
    } catch {
      // Share sheet dismissed: nothing to do.
    }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="public-airline">
      <section
        className="rounded-2xl p-5 text-white"
        style={{
          background: `linear-gradient(135deg, ${airline.livery.primary}, ${airline.livery.secondary}33)`,
        }}
      >
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">{airline.icaoCode}</p>
        <h2 className="text-3xl font-black tracking-tight">{airline.name}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [t("publicAirline.aircraft"), String(fleet.length)],
            [t("publicAirline.routes"), String(activeRoutes.length)],
            [t("publicAirline.tier"), String(airline.tier)],
            [t("publicAirline.revenue"), fpFormat(airline.cumulativeRevenue, 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] font-bold uppercase tracking-widest opacity-75">
                {label}
              </dt>
              <dd className="font-mono text-lg font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap gap-2">
        {isMine ? (
          // Your own page: share the network card too (S51).
          <ShareNetworkButton pubkey={pubkey} airline={airline} fleet={fleet} routes={routes} />
        ) : (
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-bold hover:bg-accent"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            {t("publicAirline.share")}
          </button>
        )}
        {lookup === "own" ? null : (
          <Link
            to="/join"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            {t("publicAirline.cta")}
          </Link>
        )}
      </div>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <RouteIcon className="h-4 w-4" aria-hidden="true" />
          {t("publicAirline.network")}
        </h3>
        <RouteMap airline={airline} routes={routes} />
      </section>

      {liveried.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("publicAirline.fleet")}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {liveried.slice(0, 8).map((aircraft) => {
              const model = getAircraftById(aircraft.modelId);
              return (
                <figure
                  key={aircraft.id}
                  className="overflow-hidden rounded-xl border border-border/50 bg-card"
                >
                  <div className="aspect-[4/3]">
                    <LiveryThumb
                      imageUrl={aircraft.liveryImageUrl}
                      familyId={model?.familyId}
                      color={airline.livery.primary}
                      alt={`${airline.name} ${model?.name ?? aircraft.modelId}`}
                      size="fill"
                      className="rounded-none border-0"
                    />
                  </div>
                  <figcaption className="truncate px-2 py-1.5 text-[11px] font-semibold">
                    {aircraft.name}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
