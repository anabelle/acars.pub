import { createRouter, RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
// Import the generated route tree
import { routeTree } from "../routeTree.gen";
import "../index.css";
// Initialize i18n before rendering so the detected locale's lazy bundles are
// loaded before any component that uses useTranslation mounts
import { initI18n } from "../i18n";
import { BankruptcyOverlay } from "@/features/identity/components/BankruptcyOverlay";
import { TimelineToastBridge } from "@/shared/components/feedback/TimelineToastBridge";
import { ToastHost } from "@/shared/components/feedback/ToastHost";
import { ConfirmProvider } from "@/shared/lib/useConfirm";

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

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Initialize i18n (loads the detected locale's bundles) before first render
await initI18n();

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <ToastHost />
        <TimelineToastBridge />
        <BankruptcyOverlay />
      </ConfirmProvider>
    </React.StrictMode>,
  );
}
