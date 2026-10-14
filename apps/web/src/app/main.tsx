import { bootMark } from "@acars/store";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
// Import the generated route tree
import { routeTree } from "../routeTree.gen";
import "@fontsource/b612/latin-400.css";
import "@fontsource/b612/latin-700.css";
import "@fontsource/b612-mono/latin-400.css";
import "@fontsource/b612-mono/latin-700.css";
import "@fontsource/overpass/latin-700.css";
import "@fontsource/overpass/latin-800.css";
import "../index.css";
import { BankruptcyOverlay } from "@/features/identity/components/BankruptcyOverlay";
import { NotificationBridge } from "@/features/notifications/NotificationBridge";
import { captureReferral, safeLocalStorage } from "@/features/share/referral";
import { BootTraceOverlay } from "@/shared/components/feedback/BootTraceOverlay";
import { OfflineBanner } from "@/shared/components/feedback/OfflineBanner";
import { TimelineToastBridge } from "@/shared/components/feedback/TimelineToastBridge";
import { ToastHost } from "@/shared/components/feedback/ToastHost";
import { startBootDiagnostics } from "@/shared/lib/bootDiagnostics";
import { registerServiceWorker, reloadOnStaleChunks } from "@/shared/lib/serviceWorker";
import { ConfirmProvider } from "@/shared/lib/useConfirm";

// Initialize i18n before rendering so the detected locale's lazy bundles are
// loaded before any component that uses useTranslation mounts
import { initI18n } from "../i18n";

// Startup trace marks and long-task counting (`?boot=1` shows them).
startBootDiagnostics();

// A tab opened before a deploy reloads once when one of its files is gone.
reloadOnStaleChunks();

// Create a new router instance
const router = createRouter({
  routeTree,
  // Preload route chunks on hover/touch-intent (50ms delay) so tab switches
  // don't pay the chunk fetch on the click critical path.
  defaultPreload: "intent",
  // Show the pending spinner quickly on cold navigations instead of a
  // silent frozen panel for up to a second.
  defaultPendingMs: 250,
});

// A confirm dialog never outlives the page that asked it.
const subscribeNavigation = (onNavigate: () => void) => router.history.subscribe(onNavigate);

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Initialize i18n (loads the detected locale's bundles) before first render
await initI18n();
bootMark("app: translations loaded");

// Installable app shell that works offline (S34; production builds only).
registerServiceWorker();

// Remember who referred this player (S51), for their AIRLINE_CREATE.
captureReferral(window.location.search, safeLocalStorage());

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ConfirmProvider subscribeNavigation={subscribeNavigation}>
        <RouterProvider router={router} />
        <ToastHost />
        <TimelineToastBridge />
        <NotificationBridge />
        <BankruptcyOverlay />
        <OfflineBanner />
        <BootTraceOverlay />
      </ConfirmProvider>
    </React.StrictMode>,
  );
}
