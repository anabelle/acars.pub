import type { Airport } from "@airtr/core";
import { fp, fpFormat, fpSub } from "@airtr/core";
import { getHubPricingForIata } from "@airtr/data";
import { useAirlineStore, useEngineStore } from "@airtr/store";
import { Building2, CheckCircle2, Landmark, MapPin, Palette, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AirlineTimeline } from "@/features/airline/components/Timeline";
import { HubPicker } from "@/features/network/components/HubPicker";
import { PanelLayout } from "@/shared/components/layout/PanelLayout";

/* ------------------------------------------------------------------ */
/*  Section Header                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground px-1 mb-3">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <h3 className="text-[10px] uppercase font-bold tracking-wider">{children}</h3>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Cell                                                          */
/* ------------------------------------------------------------------ */

function StatCell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-5 space-y-2">
      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className="text-xl font-bold text-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hub Confirmation Dialog                                            */
/* ------------------------------------------------------------------ */

function HubConfirmDialog({
  action,
  pricing,
  cost,
  nextMonthlyOpex,
  canAfford,
  corporateBalance,
  isProcessing,
  error,
  onConfirm,
  onCancel,
}: {
  action: { type: "add" | "switch" | "remove"; iata: string };
  pricing: { tier: string; openFee: number; monthlyOpex: number };
  cost: number;
  nextMonthlyOpex: number;
  canAfford: boolean;
  corporateBalance: number;
  isProcessing: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    confirmRef.current?.focus();
    return () => {
      dialog.close();
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
  );

  const descriptions: Record<string, string> = {
    add: "Opening a new hub activates market access and starts monthly operations costs.",
    switch: "Relocating your primary hub updates active operations with a relocation fee.",
    remove: "Closing a hub stops monthly operations costs for that location.",
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === dialogRef.current) onCancel();
      }}
      aria-label={`Hub contract review for ${action.iata}`}
      className="fixed inset-0 z-50 m-auto w-full max-w-xl rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b1117] via-[#0d1218] to-[#101722] p-0 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-in open:fade-in open:zoom-in-95"
      style={{ overscrollBehavior: "contain" }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              Hub Contract Review
            </p>
            <h3 className="mt-2 text-2xl font-black text-white" style={{ textWrap: "balance" }}>
              {action.iata} &middot; {pricing.tier.toUpperCase()}
            </h3>
            <p className="mt-1 text-sm text-white/60">{descriptions[action.type]}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close hub contract review"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase font-semibold text-white/40">Immediate Charge</p>
            <p
              className="mt-1 text-lg font-mono font-black text-white"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fpFormat(fp(cost), 0)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase font-semibold text-white/40">New Monthly OPEX</p>
            <p
              className="mt-1 text-lg font-mono font-black text-white"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fpFormat(fp(nextMonthlyOpex), 0)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase font-semibold text-white/40">Cash After</p>
            <p
              className={`mt-1 text-lg font-mono font-black ${canAfford ? "text-emerald-300" : "text-rose-300"}`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {fpFormat(fpSub(fp(corporateBalance), fp(cost)), 0)}
            </p>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </p>
        )}

        {!canAfford && (
          <output className="mt-4 block rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Insufficient liquidity for this hub action.
          </output>
        )}

        <div className="mt-6 flex items-center justify-between">
          <p className="text-[10px] uppercase text-white/40">
            Charges apply immediately &middot; OPEX bills every 30 days
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-white/10 px-4 py-2 text-xs font-bold uppercase text-white/60 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={!canAfford || isProcessing}
              className="rounded-md bg-emerald-500/90 px-5 py-2 text-xs font-bold uppercase text-black transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Processing\u2026" : "Confirm & Charge"}
            </button>
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/*  Hub Card                                                           */
/* ------------------------------------------------------------------ */

function HubCard({
  iata,
  isActive,
  onSwitch,
  onClose,
  canClose,
}: {
  iata: string;
  isActive: boolean;
  onSwitch: () => void;
  onClose: () => void;
  canClose: boolean;
}) {
  const pricing = getHubPricingForIata(iata);

  return (
    <div
      className={`rounded-lg border p-4 flex items-center justify-between transition-colors ${
        isActive ? "bg-primary/5 border-primary/40" : "bg-background/30 border-border/30 opacity-80"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-xl font-black text-foreground">{iata}</span>
        <span className="text-[10px] font-bold uppercase text-muted-foreground">
          {pricing.tier}
        </span>
        {isActive && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
            HQ
          </span>
        )}
        <span
          className="text-[10px] font-mono text-muted-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {fpFormat(fp(pricing.monthlyOpex), 0)}/mo
        </span>
      </div>
      {!isActive && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSwitch}
            className="text-[10px] font-bold uppercase text-muted-foreground border border-white/10 px-3 py-1.5 rounded transition-colors hover:text-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Set as HQ
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={!canClose}
            className="text-[10px] font-bold uppercase text-rose-300/70 border border-rose-400/20 px-3 py-1.5 rounded transition-colors hover:text-rose-200 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
            title={!canClose ? "Cannot close last hub" : undefined}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Corporate Dashboard                                                */
/* ------------------------------------------------------------------ */

export default function CorporateDashboard() {
  const { airline, modifyHubs } = useAirlineStore();
  const homeAirport = useEngineStore((s) => s.homeAirport);
  const [pendingAction, setPendingAction] = useState<{
    type: "add" | "switch" | "remove";
    iata: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentMonthlyOpex = useMemo(
    () => airline?.hubs.reduce((sum, hub) => sum + getHubPricingForIata(hub).monthlyOpex, 0) ?? 0,
    [airline?.hubs],
  );

  const handleAddHub = (airport: Airport | null) => {
    if (!airport || !airline || airline.hubs.includes(airport.iata)) return;
    setActionError(null);
    setPendingAction({ type: "add", iata: airport.iata });
  };

  const handleSwitchActiveHub = (iata: string) => {
    setActionError(null);
    setPendingAction({ type: "switch", iata });
  };

  const handleCloseHub = (iata: string) => {
    setActionError(null);
    setPendingAction({ type: "remove", iata });
  };

  const confirmHubAction = async () => {
    if (!pendingAction || !airline) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await modifyHubs(pendingAction);
      setPendingAction(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete hub action";
      setActionError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingPricing = pendingAction ? getHubPricingForIata(pendingAction.iata) : null;
  const pendingSetupFee = pendingPricing ? pendingPricing.openFee : 0;
  const pendingRelocationFee = pendingPricing ? pendingPricing.openFee * 0.25 : 0;
  const pendingCostRaw =
    pendingAction?.type === "add"
      ? pendingSetupFee
      : pendingAction?.type === "switch"
        ? pendingRelocationFee
        : 0;

  const nextMonthlyOpex = pendingAction
    ? pendingAction.type === "add"
      ? currentMonthlyOpex + (pendingPricing?.monthlyOpex ?? 0)
      : pendingAction.type === "remove"
        ? Math.max(0, currentMonthlyOpex - (pendingPricing?.monthlyOpex ?? 0))
        : currentMonthlyOpex
    : currentMonthlyOpex;

  const canAfford = airline ? fp(pendingCostRaw) <= airline.corporateBalance : false;

  if (!airline) return null;

  return (
    <PanelLayout>
      <div className="flex h-full w-full flex-col p-6 overflow-y-auto custom-scrollbar">
        {/* ---- Page Header ---- */}
        <div className="mb-8 flex items-center justify-between pr-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <h2
              className="text-2xl font-bold tracking-tight text-foreground"
              style={{ textWrap: "balance" }}
            >
              {airline.name}
            </h2>
          </div>
          <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold uppercase text-primary">
            {airline.status}
          </span>
        </div>

        {/* ---- Identity & Finance ---- */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCell
            label="ICAO / Callsign"
            value={
              <span className="font-mono">
                {airline.icaoCode}
                <span className="mx-2 text-muted-foreground/40">/</span>
                {airline.callsign}
              </span>
            }
          />
          <StatCell
            label="Corporate Balance"
            value={<span className="text-green-400">{fpFormat(airline.corporateBalance, 0)}</span>}
            sub={`Hub OPEX: ${fpFormat(fp(currentMonthlyOpex), 0)}/mo`}
          />
        </div>

        {/* ---- Hubs ---- */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon={MapPin}>Operations Centers</SectionHeader>
            <HubPicker currentHub={null} onSelect={handleAddHub} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {airline.hubs.map((hub) => (
              <HubCard
                key={hub}
                iata={hub}
                isActive={homeAirport?.iata === hub}
                onSwitch={() => handleSwitchActiveHub(hub)}
                onClose={() => handleCloseHub(hub)}
                canClose={airline.hubs.length > 1}
              />
            ))}
          </div>
        </section>

        {/* ---- Livery ---- */}
        <section className="mb-8">
          <SectionHeader icon={Palette}>Corporate Livery</SectionHeader>
          <div className="rounded-lg border border-border/30 bg-background/30 p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-10 rounded-lg border border-border/50 flex overflow-hidden shadow-inner">
                <div
                  className="h-full"
                  style={{ width: "70%", backgroundColor: airline.livery.primary }}
                />
                <div
                  className="h-full"
                  style={{ width: "30%", backgroundColor: airline.livery.secondary }}
                />
              </div>
              <div className="shrink-0 flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="h-6 w-6 rounded border border-border/50"
                    style={{ backgroundColor: airline.livery.primary }}
                  />
                  <span className="text-[9px] text-muted-foreground mt-1">Primary</span>
                </div>
                <div className="flex flex-col items-center">
                  <div
                    className="h-6 w-6 rounded border border-border/50"
                    style={{ backgroundColor: airline.livery.secondary }}
                  />
                  <span className="text-[9px] text-muted-foreground mt-1">Secondary</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Audit Trail ---- */}
        <section>
          <SectionHeader icon={Landmark}>Operations Ledger</SectionHeader>
          <div className="rounded-xl border border-border/50 bg-background/50 overflow-hidden">
            <AirlineTimeline />
          </div>
        </section>
      </div>

      {/* ---- Hub Confirmation Dialog ---- */}
      {pendingAction && pendingPricing && (
        <HubConfirmDialog
          action={pendingAction}
          pricing={pendingPricing}
          cost={pendingCostRaw}
          nextMonthlyOpex={nextMonthlyOpex}
          canAfford={canAfford}
          corporateBalance={
            typeof airline.corporateBalance === "number" ? airline.corporateBalance : 0
          }
          isProcessing={isProcessing}
          error={actionError}
          onConfirm={confirmHubAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </PanelLayout>
  );
}
