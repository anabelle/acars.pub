import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { MOBILE_BOTTOM_NAV_BOTTOM_CLASS } from "@/shared/components/layout/mobileLayout";
import { ModalPortal } from "@/shared/components/ModalPortal";

/**
 * One card style for whatever you tap on the globe (S56.3): a route, an
 * airport or an aircraft answers in the same compact card in the bottom
 * right corner, a bottom sheet on phones, with doors into the full panels.
 * Escape and the X close it. Portaled above the app chrome, so on a phone it
 * covers the folded briefing instead of hiding under it.
 */
export function MapCard({
  testId,
  icon: Icon,
  kicker,
  title,
  subtitle,
  closeLabel,
  onClose,
  children,
  actions,
  ...data
}: {
  testId: string;
  icon: LucideIcon;
  kicker: string;
  title: ReactNode;
  subtitle?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children?: ReactNode;
  actions?: ReactNode;
} & { [key: `data-${string}`]: string | undefined }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const titleId = `${testId}-title`;
  return (
    <ModalPortal>
      <section
        data-testid={testId}
        aria-labelledby={titleId}
        {...data}
        className={`pointer-events-auto fixed inset-x-3 z-[70] rounded-[24px] border border-border/80 bg-background p-4 sm:bg-background/96 shadow-[0_26px_80px_rgba(0,0,0,0.68)] backdrop-blur-2xl ${MOBILE_BOTTOM_NAV_BOTTOM_CLASS} sm:inset-x-auto sm:right-20 sm:bottom-14 sm:w-96`}
      >
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
              {kicker}
            </p>
            <h2 id={titleId} className="truncate text-lg font-black text-foreground">
              {title}
            </h2>
            {subtitle ? (
              <p
                className="truncate text-xs text-muted-foreground"
                data-testid={`${testId}-subtitle`}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </section>
    </ModalPortal>
  );
}

/** A labelled figure in a card's 2×2 grid. */
export function MapCardStat({
  label,
  value,
  testId,
}: {
  label: string;
  value: ReactNode;
  testId?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-background/60 px-2.5 py-2">
      <dt className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate font-mono text-sm font-bold" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

export const MAP_CARD_PRIMARY_ACTION =
  "inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground";
export const MAP_CARD_SECONDARY_ACTION =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent";
