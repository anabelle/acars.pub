import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export type SignVariant = "location" | "direction" | "mandatory";
export type SignArrow = "left" | "right" | "up" | "down";

const ARROWS: Record<SignArrow, string> = { left: "◀", right: "▶", up: "▲", down: "▼" };

const VARIANTS: Record<SignVariant, string> = {
  // Yellow on black with a yellow border: where you are.
  location:
    "bg-sign-black text-sign-yellow shadow-[inset_0_0_0_2px_rgb(var(--sign-black)),inset_0_0_0_4px_rgb(var(--sign-yellow))]",
  // Black on yellow: where you can go.
  direction: "bg-sign-yellow text-sign-black",
  // White on red: must stop (maintenance, bankruptcy, hold).
  mandatory: "bg-sign-red text-nd-white",
};

type Props = {
  variant: SignVariant;
  children: ReactNode;
  /** Direction signs point somewhere; the arrow sits on the side it points to. */
  arrow?: SignArrow;
  className?: string;
};

/**
 * An airport sign (Ramp, S59): used sparingly, as an accent, one per card.
 * Overpass caps; the arrow is decorative, the text carries the meaning.
 */
export function Sign({ variant, children, arrow, className }: Props) {
  const glyph = arrow ? (
    <span aria-hidden="true" className="text-[0.8em]">
      {ARROWS[arrow]}
    </span>
  ) : null;
  return (
    <span
      data-sign={variant}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-[3px] px-3 font-sign text-sm font-extrabold uppercase tracking-[0.06em]",
        VARIANTS[variant],
        className,
      )}
    >
      {arrow === "left" || arrow === "up" ? glyph : null}
      <span>{children}</span>
      {arrow === "right" || arrow === "down" ? glyph : null}
    </span>
  );
}
