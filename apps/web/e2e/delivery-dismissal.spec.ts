import { expect, test } from "./fixtures";
import { continuePastDelivery } from "./livery";

test("delivery dismissal is a no-op when no ceremonies are pending", async ({ page }) => {
  await page.setContent("<main>No pending deliveries</main>");
  await continuePastDelivery(page);
  await expect(page.getByTestId("delivery-ceremony")).toHaveCount(0);
});

test("delivery dismissal allows a slow Continue within the overall budget", async ({ page }) => {
  await page.setContent(
    '<div data-testid="delivery-ceremony"><button disabled>Continue</button></div>',
  );
  await page.evaluate(() => {
    const button = document.querySelector("button");
    if (!button) throw new Error("missing Continue fixture");
    button.addEventListener("click", () => button.parentElement?.remove());
    // Exceed the old per-click limit without exceeding the queue's overall budget.
    setTimeout(() => {
      button.disabled = false;
    }, 2_500);
  });

  await continuePastDelivery(page);

  await expect(page.getByTestId("delivery-ceremony")).toHaveCount(0);
});

test("delivery dismissal drains more than eight queued ceremonies", async ({ page }) => {
  // Model DeliveryCeremony's keyed queue: closing one dialog replaces it with the next.
  // Use DOM-only fixtures here to exercise the helper independently of aircraft delivery timing.
  await page.setContent('<main id="ceremonies"></main>');
  await page.evaluate(() => {
    const root = document.getElementById("ceremonies");
    if (!root) throw new Error("missing ceremony fixture");
    let remaining = 12;
    const render = () => {
      root.replaceChildren();
      root.dataset.remaining = String(remaining);
      if (remaining === 0) return;
      const dialog = document.createElement("div");
      dialog.dataset.testid = "delivery-ceremony";
      dialog.setAttribute("role", "dialog");
      const button = document.createElement("button");
      button.textContent = "Continue";
      button.addEventListener("click", () => {
        remaining -= 1;
        render();
      });
      dialog.append(button);
      root.append(dialog);
    };
    render();
  });

  await continuePastDelivery(page);

  await expect(page.getByTestId("delivery-ceremony")).toHaveCount(0);
  await expect(page.locator("#ceremonies")).toHaveAttribute("data-remaining", "0");
});
