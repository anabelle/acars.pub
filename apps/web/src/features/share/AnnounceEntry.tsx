import type { Route } from "@acars/core";
import { getAirports } from "@acars/data";
import { useAirlineStore } from "@acars/store";
import { Megaphone } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { recordRivalryPost, rivalryPostsLeft } from "./rivalryLimit";
import { SocialPostDialog } from "./SocialPostDialog";

function cityOf(iata: string): string {
  try {
    return getAirports().find((airport) => airport.iata === iata)?.city ?? iata;
  } catch {
    return iata;
  }
}

/**
 * Announce entering a rival's market (S74, D18): opt-in, previewed, and at
 * most three a day — "{airline} enters {city}".
 */
export function AnnounceEntry({ route }: { route: Route }) {
  const { t } = useTranslation("game");
  const airline = useAirlineStore((s) => s.airline);
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(() => rivalryPostsLeft());
  if (!airline) return null;
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2" data-testid="announce-entry">
      <button
        type="button"
        disabled={left === 0}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50"
      >
        <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
        {t("socialPost.rivalry.button")}
      </button>
      <span className="text-[10px] text-muted-foreground">
        {left > 0 ? t("socialPost.rivalry.left", { count: left }) : t("socialPost.rivalry.none")}
      </span>
      {open ? (
        <SocialPostDialog
          testId="rivalry-post-dialog"
          title={t("socialPost.rivalry.title")}
          initialText={t("socialPost.rivalry.text", {
            airline: airline.name,
            city: cityOf(route.destinationIata),
            origin: route.originIata,
            destination: route.destinationIata,
          })}
          build={async (text, link) =>
            (await import("@acars/nostr")).buildRivalryNote({ text, link })
          }
          onPosted={() => {
            recordRivalryPost();
            setLeft(rivalryPostsLeft());
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
