import {
  formatBootTrace,
  getBootTrace,
  subscribeBootTrace,
  useAirlineStore,
  useEngineStore,
} from "@acars/store";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getLongTaskSummary, isBootTraceRequested } from "@/shared/lib/bootDiagnostics";

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Startup trace panel (`?boot=1`): each boot stage with its time, live
 * catch-up progress and main-thread long tasks, plus a Copy button so a
 * player can paste it into a bug report. Developer tool, English only.
 */
export function BootTraceOverlay() {
  const [enabled] = useState(() => isBootTraceRequested(window.location.search, sessionStore()));
  const trace = useSyncExternalStore(subscribeBootTrace, getBootTrace, getBootTrace);
  const identityStatus = useAirlineStore((s) => s.identityStatus);
  const catchup = useEngineStore((s) => s.catchupProgress);
  const [now, setNow] = useState(() => performance.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(timer);
  }, [enabled]);

  if (!enabled) return null;

  const tasks = getLongTaskSummary();
  const extra = [
    `${(now / 1000).toFixed(2).padStart(7)}s  now: identity ${identityStatus}${
      catchup ? `, catching up ${catchup.phase} ${catchup.current}/${catchup.target}` : ""
    }`,
    `long tasks: ${tasks.count}, ${(tasks.totalMs / 1000).toFixed(1)}s total, longest ${(
      tasks.longestMs / 1000
    ).toFixed(1)}s at ${(tasks.longestAt / 1000).toFixed(1)}s`,
    `${navigator.userAgent}`,
  ];
  const text = formatBootTrace(trace, extra);

  return (
    <div
      data-testid="boot-trace"
      className="pointer-events-auto fixed bottom-2 left-2 z-[100] max-h-[60vh] w-[min(28rem,calc(100vw-1rem))] overflow-auto rounded-lg border border-white/20 bg-black/85 p-2 font-mono text-[10px] leading-tight text-emerald-200 shadow-2xl"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-bold text-white">Startup trace</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true));
          }}
          className="rounded bg-white/15 px-2 py-0.5 text-white hover:bg-white/25"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap">{text}</pre>
    </div>
  );
}
