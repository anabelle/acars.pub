/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { useTranslation } from "react-i18next";
import type { ConfirmOptions } from "@/shared/lib/confirm";
import { ConfirmContext } from "@/shared/lib/confirm-context";

const ConfirmProviderComponent = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation("common");
  const [request, setRequest] = React.useState<ConfirmOptions | null>(null);
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setRequest(options);
    });
  }, []);

  const handleResolve = React.useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  React.useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleResolve(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [request, handleResolve]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {request ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => handleResolve(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={request.description ? descriptionId : undefined}
            className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background/95 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            <div className="px-6 pt-6">
              <h2 id={titleId} className="text-base font-semibold text-foreground">
                {request.title}
              </h2>
              {request.description ? (
                <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
                  {request.description}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-5">
              <button
                type="button"
                onClick={() => handleResolve(false)}
                className="rounded-md border border-border bg-background/60 px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                {request.cancelLabel ?? t("actions.cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleResolve(true)}
                // biome-ignore lint/a11y/noAutofocus: a confirm dialog must take focus.
                autoFocus
                className={`rounded-md px-3.5 py-2 text-sm font-semibold text-white transition-colors ${
                  request.tone === "destructive"
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                {request.confirmLabel ?? t("actions.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
};

export const ConfirmProvider = ConfirmProviderComponent;

export const useConfirm = () => {
  const context = React.useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return context.confirm;
};
