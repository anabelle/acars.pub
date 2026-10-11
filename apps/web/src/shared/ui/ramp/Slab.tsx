import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

export type SlabEdge = "none" | "sign" | "normal" | "idle";

const EDGES: Record<SlabEdge, string | undefined> = {
  none: undefined,
  sign: "rgb(var(--sign-yellow))",
  normal: "rgb(var(--nd-green))",
  idle: "rgb(var(--hi-vis))",
};

type Props = HTMLAttributes<HTMLDivElement> & {
  /** A painted 3 px top edge that says what the card is about. */
  edge?: SlabEdge;
};

/** A concrete-slab card on the ramp (S59): grain texture, 3 px corners. */
export function Slab({ edge = "none", className, style, ...rest }: Props) {
  const colour = EDGES[edge];
  return (
    <div
      data-edge={edge}
      className={cn("ramp-slab text-ramp-paint", className)}
      style={
        colour
          ? { boxShadow: `inset 0 3px 0 ${colour}, 0 1px 0 rgb(0 0 0 / 0.25)`, ...style }
          : style
      }
      {...rest}
    />
  );
}
