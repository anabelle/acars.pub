import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyBackupPrompt } from "./KeyBackupPrompt";

type State = {
  initializeIdentity: () => Promise<void>;
  isLoading: boolean;
  pubkey: string | null;
  airline: { cumulativeRevenue: number } | null;
};

let storeState: State;
const mockWriteText = vi.fn().mockResolvedValue(undefined);

vi.mock("@acars/store", () => ({
  useAirlineStore: (selector: (state: State) => unknown) => selector(storeState),
}));

vi.mock("@acars/nostr", () => ({
  hasNip07: () => false,
  hasStoredEphemeralKey: () => true,
  loadEphemeralKey: () => Promise.resolve("nsec1testvalue"),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const landed = (revenue: number): State => ({
  initializeIdentity: vi.fn().mockResolvedValue(undefined),
  isLoading: false,
  pubkey: "pubkey-1",
  airline: { cumulativeRevenue: revenue },
});

describe("KeyBackupPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    storeState = landed(1_000);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    mockWriteText.mockClear();
  });

  it("stays away until the first landing, then asks", () => {
    storeState = landed(0);
    const { rerender } = render(<KeyBackupPrompt />);
    expect(screen.queryByTestId("key-backup-prompt")).not.toBeInTheDocument();

    storeState = landed(1_000);
    rerender(<KeyBackupPrompt />);
    const prompt = screen.getByTestId("key-backup-prompt");
    expect(prompt).toHaveAttribute("data-moment", "landing");
    expect(prompt).toHaveTextContent(/first flight landed/i);
  });

  it("shows once per visit and welcomes the player back on the next one", () => {
    render(<KeyBackupPrompt />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("key-backup-prompt")).not.toBeInTheDocument();

    // Same visit: a remount (route change) doesn't ask again.
    cleanup();
    render(<KeyBackupPrompt />);
    expect(screen.queryByTestId("key-backup-prompt")).not.toBeInTheDocument();

    // Next visit: a new browser session.
    cleanup();
    sessionStorage.clear();
    render(<KeyBackupPrompt />);
    expect(screen.getByTestId("key-backup-prompt")).toHaveAttribute("data-moment", "return");
    expect(screen.getByTestId("key-backup-prompt")).toHaveTextContent(/welcome back/i);

    // And never after that.
    cleanup();
    sessionStorage.clear();
    render(<KeyBackupPrompt />);
    expect(screen.queryByTestId("key-backup-prompt")).not.toBeInTheDocument();
  });

  it("closes for good once the key is copied", async () => {
    render(<KeyBackupPrompt />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy my secret key/i }));
    });
    await waitFor(() => expect(screen.queryByTestId("key-backup-prompt")).not.toBeInTheDocument());
    expect(mockWriteText).toHaveBeenCalledWith("nsec1testvalue");

    cleanup();
    sessionStorage.clear();
    render(<KeyBackupPrompt />);
    expect(screen.queryByTestId("key-backup-prompt")).not.toBeInTheDocument();
  });

  it("never shows for a secured account", () => {
    localStorage.setItem("acars:banner:secured:pubkey-1", "1");
    render(<KeyBackupPrompt />);
    expect(screen.queryByTestId("key-backup-prompt")).not.toBeInTheDocument();
  });

  it("has no wallet upgrade button and closes from the corner", () => {
    render(<KeyBackupPrompt />);
    expect(screen.queryByRole("button", { name: /wallet|extension/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("key-backup-prompt")).not.toBeInTheDocument();
  });
});
