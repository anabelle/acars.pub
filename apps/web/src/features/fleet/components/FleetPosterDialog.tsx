import type { AircraftInstance, AirlineEntity, Route } from "@acars/core";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  drawFleetPoster,
  layoutFleetPoster,
  loadPosterImages,
  POSTER_FORMATS,
  type PosterFormat,
  type PosterInput,
  posterFileName,
} from "@/features/fleet/utils/fleetPoster";
import { ModalPortal } from "@/shared/components/ModalPortal";

/** Fleet poster preview and PNG download (S44). */
export function FleetPosterDialog({
  airline,
  fleet,
  routes,
  onClose,
}: {
  airline: AirlineEntity;
  fleet: readonly AircraftInstance[];
  routes: readonly Route[];
  onClose: () => void;
}) {
  const { t } = useTranslation("game");
  const [format, setFormat] = useState<PosterFormat>("portrait");
  // Which (format, input) the canvas currently shows; derived, not reset.
  const [drawn, setDrawn] = useState<{ format: PosterFormat; input: PosterInput } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const input = useMemo<PosterInput>(
    () => ({
      airlineName: airline.name,
      icaoCode: airline.icaoCode,
      colors: airline.livery,
      stats: [
        { label: t("fleet.poster.aircraft"), value: String(fleet.length) },
        {
          label: t("fleet.poster.routes"),
          value: String(routes.filter((route) => route.status === "active").length),
        },
        { label: t("fleet.poster.tier"), value: String(airline.tier) },
      ],
      // Aircraft with a livery first, so the poster shows off the art.
      liveries: [...fleet]
        .sort((a, b) => Number(!!b.liveryImageUrl) - Number(!!a.liveryImageUrl))
        .map((aircraft) => ({ name: aircraft.name, imageUrl: aircraft.liveryImageUrl })),
      footer: t("fleet.poster.footer"),
    }),
    [airline, fleet, routes, t],
  );

  useEffect(() => {
    let cancelled = false;
    const layout = layoutFleetPoster(format, input.stats.length);
    const urls = input.liveries.slice(0, layout.cells.length).map((livery) => livery.imageUrl);
    void loadPosterImages(urls).then((images) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (cancelled || !canvas || !ctx) return;
      canvas.width = layout.width;
      canvas.height = layout.height;
      drawFleetPoster(ctx, layout, input, images);
      setDrawn({ format, input });
    });
    return () => {
      cancelled = true;
    };
  }, [format, input]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error(t("fleet.poster.failed"));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = posterFileName(airline.name, format);
        link.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (error) {
      toast.error(t("fleet.poster.failed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const { width, height } = POSTER_FORMATS[format];
  const ready = drawn?.format === format && drawn.input === input;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-label={t("fleet.poster.closeAria")}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fleet-poster-title"
          data-testid="fleet-poster-dialog"
          className="relative z-10 flex w-full max-h-[100dvh] flex-col gap-4 overflow-y-auto rounded-t-[24px] border border-border bg-background/95 p-4 shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-6"
        >
          <div className="flex items-center justify-between">
            <h3 id="fleet-poster-title" className="text-lg font-bold text-foreground">
              {t("fleet.poster.title")}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-background/60 p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t("fleet.poster.closeAria")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div
            role="group"
            aria-label={t("fleet.poster.formatAria")}
            className="flex gap-2 text-xs font-bold"
          >
            {(["portrait", "landscape"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={format === option}
                onClick={() => setFormat(option)}
                className={`rounded-lg border px-3 py-1.5 ${
                  format === option
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`fleet.poster.${option}`)}
              </button>
            ))}
          </div>
          <div className="flex justify-center rounded-xl bg-black/40 p-2">
            <canvas
              ref={canvasRef}
              data-testid="fleet-poster-canvas"
              data-ready={ready ? "true" : "false"}
              width={width}
              height={height}
              className="h-auto max-h-[55vh] w-auto max-w-full rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={download}
            disabled={!ready}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t("fleet.poster.download")}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
