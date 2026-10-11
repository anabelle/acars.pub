import type { AircraftInstance, AircraftModel, AirlineEntity } from "@acars/core";
import { useTranslation } from "react-i18next";
import { useAircraftImage } from "../hooks/useAircraftImage";

interface AircraftLiveryImageProps {
  aircraft: AircraftInstance;
  airline: AirlineEntity | null;
  model: AircraftModel;
  isOwner: boolean;
  /** Fallback content rendered when no image is available (e.g., SVG silhouette) */
  fallback: React.ReactNode;
  /** Override the default `object-cover` fit on the <img>. Use `object-contain` to avoid cropping. */
  objectFit?: "object-cover" | "object-contain";
}

export function AircraftLiveryImage({
  aircraft,
  airline,
  model,
  isOwner,
  fallback,
  objectFit = "object-cover",
}: AircraftLiveryImageProps) {
  const { imageUrl, isGenerating } = useAircraftImage(aircraft, airline, model, isOwner);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${airline?.name ?? "Airline"} ${model.manufacturer} ${model.name} livery`}
        loading="lazy"
        className={`absolute inset-0 h-full w-full ${objectFit}`}
      />
    );
  }

  // While the painting is made, the fallback stays under a calm caption. A
  // failed generation is logged by the hook, never printed on screen (S60).
  return (
    <>
      {fallback}
      {isGenerating ? <PaintingCaption /> : null}
    </>
  );
}

function PaintingCaption() {
  const { t } = useTranslation("game");
  return (
    <span
      data-testid="livery-painting"
      className="absolute bottom-2 left-2 rounded-[2px] bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ramp-paint"
    >
      {t("aircraftPanel.paintingLivery")}
    </span>
  );
}
