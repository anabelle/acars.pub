import { ExternalLink, Github, Globe, Plane, Zap } from "lucide-react";
import { PanelBody, PanelHeader, PanelLayout } from "@/shared/components/layout/PanelLayout";

const GITHUB_URL = "https://github.com/anabelle/acars.pub";

const highlights = [
  {
    icon: Globe,
    title: "Decentralized on Nostr",
    description:
      "All game state lives on the Nostr protocol — no central database, no single point of failure. Your airline is yours.",
  },
  {
    icon: Plane,
    title: "Real-Time Aviation Sim",
    description:
      "Flights resolve in real-world time. A 7-hour transatlantic route takes 7 real hours. Manage your fleet like a live ops dashboard.",
  },
  {
    icon: Zap,
    title: "Bitcoin & Lightning",
    description:
      "Earn real sats through play-to-earn prize pools and Zaps. Trade airline stock slots peer-to-peer on the Lightning Network.",
  },
];

export default function AboutPage() {
  return (
    <PanelLayout>
      <PanelHeader
        title="About"
        subtitle="Open-source decentralized airline management game on Nostr."
      />
      <PanelBody className="space-y-6 pt-3 sm:pt-4">
        {/* Description */}
        <section className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">ACARS</strong> is a persistent, multiplayer airline
            tycoon built entirely on open protocols. Create an airline, acquire aircraft, open
            routes, and compete on a global leaderboard — all powered by cryptographic identity and
            decentralized relays.
          </p>
        </section>

        {/* Highlights */}
        <section className="space-y-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="flex gap-3 rounded-xl border border-border/60 bg-background/60 p-3 backdrop-blur-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Links */}
        <section className="space-y-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <Github className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex-1">View on GitHub</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
          <a
            href="https://nostr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <Globe className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="flex-1">Learn about Nostr</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
        </section>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground/60">
          MIT License · Contributions welcome
        </p>
      </PanelBody>
    </PanelLayout>
  );
}
