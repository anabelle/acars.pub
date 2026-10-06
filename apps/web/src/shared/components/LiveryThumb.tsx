import { useState } from "react";
import { FamilySilhouette } from "@/shared/components/FamilySilhouette";
import { cn } from "@/shared/lib/utils";

/** `#rrggbb` → `rgba(r, g, b, alpha)`; other CSS colours pass through. */
function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!hex) return color;
  const [r, g, b] = hex.slice(1).map((part) => Number.parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SIZES = {
  xs: "h-5 w-8",
  sm: "h-8 w-12",
  md: "h-12 w-20",
  /** Fills its parent (gallery tiles). */
  fill: "h-full w-full",
} as const;

/**
 * Small livery image (S44): the aircraft's published AI livery when it has
 * one, else the family silhouette tinted with the airline colour. Never
 * triggers generation (that stays with the owner's fleet cards), so it is
 * safe in long lists and for other airlines' aircraft.
 */
export function LiveryThumb({
  imageUrl,
  familyId,
  color,
  alt,
  size = "sm",
  className,
}: {
  imageUrl?: string | null;
  familyId?: string;
  /** Airline colour behind the silhouette (any CSS colour; `#rrggbb` gets 30% alpha). */
  color?: string;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!imageUrl && !failed;
  // Tint the background, not the silhouette: dark livery colours vanish on
  // the dark UI otherwise.
  const tint = color ? withAlpha(color, 0.3) : undefined;
  return (
    <span
      data-testid="livery-thumb"
      data-has-image={showImage ? "true" : "false"}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/40 bg-zinc-900/60",
        SIZES[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          style={tint ? { backgroundColor: tint } : undefined}
          className="flex h-full w-full items-center justify-center text-foreground/80"
          title={alt}
        >
          <FamilySilhouette
            familyId={familyId ?? "a320"}
            className={size === "fill" ? "h-16 w-16" : "h-4 w-4"}
          />
        </span>
      )}
    </span>
  );
}
