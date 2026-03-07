import type { LucideIcon } from "lucide-react";
import { ExternalLink, KeyRound, Wallet } from "lucide-react";

type NostrAccessCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onConnect: () => void;
  isLoading?: boolean;
};

export function NostrAccessCard({
  icon: Icon,
  title,
  description,
  onConnect,
  isLoading = false,
}: NostrAccessCardProps) {
  return (
    <div className="max-w-md space-y-4 rounded-2xl border border-border/60 bg-background/70 p-6 text-center shadow-2xl backdrop-blur-xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>

      <div className="space-y-2">
        <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          New to Nostr? Start here
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-left">
        <p className="text-xs font-semibold text-foreground">Fastest way to unlock this screen</p>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Use a browser wallet to sign in and approve actions.</span>
          </li>
          <li className="flex items-start gap-2">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Already have a key? You can import an existing nsec from the header.</span>
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onConnect}
        disabled={isLoading}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-60"
      >
        <Wallet className="h-4 w-4 shrink-0" />
        {isLoading ? "Connecting…" : "Continue with browser wallet"}
      </button>

      <a
        href="https://nostr.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      >
        What is Nostr?
        <ExternalLink className="h-4 w-4 shrink-0" />
      </a>
    </div>
  );
}
