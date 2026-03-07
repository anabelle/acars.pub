import type { RefObject } from "react";
import { createContext, useContext } from "react";

export const PanelScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function usePanelScrollRef() {
  const ref = useContext(PanelScrollContext);
  if (!ref) throw new Error("usePanelScrollRef must be used inside a PanelLayout");
  return ref;
}
