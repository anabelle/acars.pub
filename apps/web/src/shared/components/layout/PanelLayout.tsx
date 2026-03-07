import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { createContext, useContext, useRef } from "react";
import { cn } from "@/shared/lib/utils";

const PanelScrollContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

/**
 * Returns a ref to the PanelLayout scroll container.
 * Use this as `getScrollElement` in useVirtualizer to share
 * a single scroll surface with the panel header.
 */
export function usePanelScrollRef() {
  const ref = useContext(PanelScrollContext);
  if (!ref) throw new Error("usePanelScrollRef must be used inside a PanelLayout");
  return ref;
}

export function PanelLayout({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <PanelScrollContext.Provider value={scrollRef}>
      <div className="pointer-events-auto relative flex h-full w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-[24px] border border-border/80 bg-background/85 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl duration-300 animate-in fade-in slide-in-from-left-4 sm:rounded-[28px]">
        <div
          ref={scrollRef}
          className="custom-scrollbar flex h-full w-full min-h-0 flex-col overflow-y-auto"
        >
          {children}
        </div>
      </div>
    </PanelScrollContext.Provider>
  );
}

export function PanelHeader({
  title,
  subtitle,
  badge,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "border-b border-border/60 bg-background/88 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4",
        className,
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="min-w-0 text-lg font-black tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle ? (
            <p className="mt-1 max-w-xl text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Close Panel (View Map)"
            aria-label="Close panel and view map"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PanelBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 px-4 py-3 sm:px-6 sm:py-4", className)}>{children}</div>;
}
