import { Toaster } from "sonner";

/**
 * Phones get a collapsed stack over the top bar: expanded toasts under it
 * covered the open panel's title and close button after every action.
 */
const isPhone = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 639px)").matches;

export function ToastHost() {
  return (
    <Toaster
      position="top-right"
      expand={!isPhone()}
      closeButton
      richColors
      offset={{ top: 16, right: 16, left: 16, bottom: 16 }}
      mobileOffset={{ top: 12, right: 12, left: 12, bottom: 88 }}
      toastOptions={{
        duration: 4500,
        className:
          "bg-background/95 text-foreground border border-border shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl",
        classNames: {
          title: "text-sm font-semibold",
          description: "text-sm text-muted-foreground",
          actionButton:
            "bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent",
          cancelButton: "bg-background/70 text-foreground border border-border hover:bg-accent",
        },
      }}
    />
  );
}
