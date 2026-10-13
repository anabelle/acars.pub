import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDialogFocus } from "./useDialogFocus";

function Dialog({ onClose, posting = false }: { onClose: () => void; posting?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeRef, onClose, posting);
  return (
    <div>
      <button type="button" ref={closeRef}>
        Close
      </button>
      <select aria-label="Choose a route">
        <option>MAD → BCN</option>
      </select>
    </div>
  );
}

afterEach(cleanup);

describe("useDialogFocus", () => {
  it("focuses the close button once, not on every parent re-render", () => {
    // The plane panel re-renders every game tick with a fresh onClose.
    const { rerender } = render(<Dialog onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    const select = screen.getByRole("combobox", { name: "Choose a route" });
    select.focus();
    for (let tick = 0; tick < 3; tick++) rerender(<Dialog onClose={() => {}} />);
    expect(select).toHaveFocus();
  });

  it("closes on Escape with the latest onClose, unless disabled", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<Dialog onClose={first} />);
    rerender(<Dialog onClose={latest} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    rerender(<Dialog onClose={latest} posting />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(latest).toHaveBeenCalledTimes(1);
  });
});
