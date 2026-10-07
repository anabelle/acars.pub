import { useAirlineStore } from "@acars/store";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { airlinePath } from "@/features/airline/utils/airlineKey";
import { renderAirlineCardPng } from "@/features/airline/utils/ogImage";
import { ModalPortal } from "@/shared/components/ModalPortal";
import type { PostableMilestone } from "./milestonePosts";
import { type NotePoster, nostrPoster } from "./notePoster";
import { catalogAirportByIata, shareFileName, summaryFromState } from "./shareNetwork";

/**
 * Opt-in milestone post (S51.2): previews the note (editable text and the
 * network image) and publishes nothing until the player presses Post.
 */
export function MilestonePostDialog({
  milestone,
  onClose,
  poster = nostrPoster,
}: {
  milestone: PostableMilestone;
  onClose: () => void;
  poster?: NotePoster;
}) {
  const { t } = useTranslation("game");
  const pubkey = useAirlineStore((s) => s.pubkey);
  const airline = useAirlineStore((s) => s.airline);
  const fleet = useAirlineStore((s) => s.fleet);
  const routes = useAirlineStore((s) => s.routes);
  const [text, setText] = useState(() =>
    milestone.kind === "tierUp"
      ? t("milestonePost.text.tierUp", { airline: airline?.name ?? "", tier: milestone.tier })
      : t("milestonePost.text.firstJet", { airline: airline?.name ?? "", model: milestone.model }),
  );
  const [includeImage, setIncludeImage] = useState(true);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [posting, setPosting] = useState(false);

  const summary = useMemo(
    () => (airline ? summaryFromState(airline, fleet, routes) : null),
    [airline, fleet, routes],
  );

  useEffect(() => {
    if (!summary) return;
    let cancelled = false;
    let url: string | null = null;
    void renderAirlineCardPng(summary, catalogAirportByIata).then((png) => {
      if (cancelled) return;
      const blob = new Blob([png], { type: "image/png" });
      url = URL.createObjectURL(blob);
      setImage({ blob, url });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [summary]);

  if (!airline || !pubkey) return null;

  const post = async () => {
    setPosting(true);
    try {
      const imageUrl =
        includeImage && image
          ? await poster.upload(image.blob, shareFileName(airline.icaoCode))
          : null;
      const note = await poster.build({
        text,
        imageUrl,
        link: `${window.location.origin}${airlinePath(pubkey)}`,
      });
      await poster.publish(note);
      toast.success(t("milestonePost.posted"));
      onClose();
    } catch (error) {
      toast.error(t("milestonePost.failed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPosting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-label={t("milestonePost.cancel")}
          tabIndex={-1}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="milestone-post-title"
          data-testid="milestone-post-dialog"
          className="relative z-10 w-full max-w-md rounded-3xl border border-border/60 bg-background/95 p-5 shadow-2xl"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t("milestonePost.cancel")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <h2 id="milestone-post-title" className="text-lg font-black tracking-tight">
            {t("milestonePost.title")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("milestonePost.intro")}</p>

          <label
            className="mt-4 block text-xs font-bold text-muted-foreground"
            htmlFor="milestone-post-text"
          >
            {t("milestonePost.textLabel")}
          </label>
          <textarea
            id="milestone-post-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-xl border border-border/60 bg-background p-3 text-sm"
          />

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeImage}
              onChange={(event) => setIncludeImage(event.target.checked)}
            />
            {t("milestonePost.includeImage")}
          </label>
          {includeImage && image && (
            <img
              src={image.url}
              alt={t("milestonePost.imageAlt")}
              data-testid="milestone-post-image"
              className="mt-2 w-full rounded-xl border border-border/60"
            />
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-accent"
            >
              {t("milestonePost.cancel")}
            </button>
            <button
              type="button"
              onClick={post}
              disabled={posting || !text.trim() || (includeImage && !image)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {posting ? t("milestonePost.posting") : t("milestonePost.post")}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
