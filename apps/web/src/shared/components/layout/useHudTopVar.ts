import { useLayoutEffect } from "react";

/**
 * Publishes where the workspace starts below the top chrome as `--hud-top`
 * (S60). Floating panels anchor to it, so a banner that pushes the bars down
 * never hides a panel's top under them.
 */
export function useHudTopVar(element: HTMLElement | null) {
  useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--hud-top", `${Math.round(element.getBoundingClientRect().top)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--hud-top");
    };
  }, [element]);
}
