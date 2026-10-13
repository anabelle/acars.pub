import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ConfirmProvider, useConfirm } from "./useConfirm";

type Ask = ReturnType<typeof useConfirm>;
let ask: Ask;
const keep = (confirm: Ask) => {
  ask = confirm;
};
function Asker({ onReady }: { onReady: (confirm: Ask) => void }) {
  const confirm = useConfirm();
  useEffect(() => onReady(confirm), [confirm, onReady]);
  return null;
}

function setup() {
  const listeners = new Set<() => void>();
  const subscribeNavigation = (onNavigate: () => void) => {
    listeners.add(onNavigate);
    return () => listeners.delete(onNavigate);
  };
  render(
    <ConfirmProvider subscribeNavigation={subscribeNavigation}>
      <Asker onReady={keep} />
    </ConfirmProvider>,
  );
  return { navigate: () => act(() => listeners.forEach((listener) => listener())), listeners };
}

afterEach(cleanup);

describe("ConfirmProvider", () => {
  it("answers yes or no from the dialog", async () => {
    setup();
    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => {
      answer = ask({ title: "Launch?", confirmLabel: "Launch" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Launch" }));
    await expect(answer).resolves.toBe(true);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("cancels a pending question when the player navigates away", async () => {
    const { navigate, listeners } = setup();
    let answer: Promise<boolean> = Promise.resolve(true);
    act(() => {
      answer = ask({ title: "Open route?" });
    });
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Open route?");
    navigate();
    await expect(answer).resolves.toBe(false);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(listeners.size).toBe(0);
  });

  it("answers no to an unanswered question when a newer one replaces it", async () => {
    setup();
    let first: Promise<boolean> = Promise.resolve(true);
    act(() => {
      first = ask({ title: "First?" });
    });
    act(() => {
      void ask({ title: "Second?" });
    });
    await expect(first).resolves.toBe(false);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Second?");
  });
});
