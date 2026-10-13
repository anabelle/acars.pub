import { type RefObject, useEffect, useRef } from "react";

/**
 * A dialog's focus and Escape: focuses `focusRef` once, when the dialog opens,
 * and closes on Escape unless `escapeDisabled`. The latest `onClose` and
 * `escapeDisabled` are read through refs, so a parent re-rendering with a new
 * `onClose` (every game tick, in the plane panel) never steals focus back to
 * the close button — that closed open dropdowns in the day planner.
 */
export function useDialogFocus(
  focusRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  escapeDisabled = false,
): void {
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(escapeDisabled);
  useEffect(() => {
    onCloseRef.current = onClose;
    disabledRef.current = escapeDisabled;
  });

  useEffect(() => {
    focusRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disabledRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusRef]);
}
