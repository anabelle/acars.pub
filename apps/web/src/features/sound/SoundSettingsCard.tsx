import { Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { playNotes } from "./player";
import { setSoundEnabled, useSoundEnabled } from "./soundSettings";
import { landingChime } from "./tones";

/** "Sound on this device" (S76): off by default; switching on plays a sample chime. */
export function SoundSettingsCard({ play = playNotes }: { play?: typeof playNotes }) {
  const { t } = useTranslation("game");
  const enabled = useSoundEnabled();
  return (
    <section
      data-testid="sound-settings"
      className="flex items-center justify-between gap-3 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm"
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {t("sound.kicker")}
        </p>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t("sound.description")}</p>
      </div>
      <button
        type="button"
        aria-pressed={enabled}
        data-testid="sound-toggle"
        onClick={() => {
          setSoundEnabled(!enabled);
          if (!enabled) play(landingChime(0.9));
        }}
        className={cn(
          "flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold",
          enabled
            ? "border-primary/60 bg-primary/15 text-primary"
            : "border-border/60 text-muted-foreground hover:text-foreground",
        )}
      >
        {enabled ? (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        )}
        {enabled ? t("sound.on") : t("sound.off")}
      </button>
    </section>
  );
}
