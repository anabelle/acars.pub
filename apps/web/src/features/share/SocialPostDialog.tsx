import type { NoteDraft } from "@acars/nostr";
import { useAirlineStore } from "@acars/store";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { airlinePath } from "@/features/airline/utils/airlineKey";
import { ModalPortal } from "@/shared/components/ModalPortal";
import { type NotePoster, nostrPoster } from "./notePoster";
import { withReferral } from "./referral";

/**
 * An opt-in social post (S74): a preview with editable text (and the image,
 * when there is one); nothing is published until the player presses Post.
 */
export function SocialPostDialog({
  testId,
  title,
  initialText,
  imageUrl,
  build,
  onClose,
  onPosted,
  publish = nostrPoster.publish,
}: {
  testId: string;
  title: string;
  initialText: string;
  imageUrl?: string;
  build: (text: string, link: string) => Promise<NoteDraft>;
  onClose: () => void;
  onPosted?: () => void;
  publish?: NotePoster["publish"];
}) {
  const { t } = useTranslation("game");
  const pubkey = useAirlineStore((s) => s.pubkey);
  const [text, setText] = useState(initialText);
  const [posting, setPosting] = useState(false);
  if (!pubkey) return null;

  const post = async () => {
    setPosting(true);
    try {
      const link = withReferral(`${window.location.origin}${airlinePath(pubkey)}`, pubkey);
      await publish(await build(text, link));
      toast.success(t("socialPost.posted"));
      onPosted?.();
      onClose();
    } catch (error) {
      toast.error(t("socialPost.failed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPosting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/80"
          onClick={onClose}
          aria-label={t("socialPost.cancel")}
          tabIndex={-1}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${testId}-title`}
          data-testid={testId}
          className="relative z-10 w-full max-w-md rounded-3xl border border-border/60 bg-background/95 p-5 shadow-2xl"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t("socialPost.cancel")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <h2 id={`${testId}-title`} className="text-lg font-black tracking-tight">
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("socialPost.intro")}</p>
          <label
            className="mt-4 block text-xs font-bold text-muted-foreground"
            htmlFor={`${testId}-text`}
          >
            {t("socialPost.textLabel")}
          </label>
          <textarea
            id={`${testId}-text`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-xl border border-border/60 bg-background p-3 text-sm"
          />
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              data-testid={`${testId}-image`}
              className="mt-2 w-full rounded-xl border border-border/60"
            />
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-accent"
            >
              {t("socialPost.cancel")}
            </button>
            <button
              type="button"
              onClick={post}
              disabled={posting || !text.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {posting ? t("socialPost.posting") : t("socialPost.post")}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
