import path from "node:path";
import { expect, gotoReady, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (!process.env.S26_SCREENSHOT) return;
  await page.screenshot({ path: path.resolve(process.env.S26_SCREENSHOT, name) });
};

/** A guest launches MAD → BCN, then game time runs until the first flight lands. */
async function flyFirstFlight(
  page: import("@playwright/test").Page,
  {
    signUp,
    launchLabel,
    confirmLabel,
    liveText,
  }: { signUp: () => Promise<void>; launchLabel: RegExp; confirmLabel: RegExp; liveText: RegExp },
) {
  // Fake timers with time flowing normally, so we can jump ahead.
  await page.clock.install();
  await signUp();
  const prompt = page.getByTestId("key-backup-prompt");
  await expect(prompt).toHaveCount(0);

  await navigateInApp(page, "/airport/BCN");
  await page.getByTestId("route-decision-card").getByRole("button", { name: launchLabel }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: confirmLabel }).click();
  // The launch leases and assigns after opening the route: wait for all of it.
  await expect(page.getByText(liveText)).toBeVisible({ timeout: 30_000 });
  await navigateInApp(page, "/");
  // Nothing to lose yet.
  await expect(prompt).toHaveCount(0);

  // Step game time (up to two days) until the first flight lands.
  for (let step = 0; step < 96 && (await prompt.count()) === 0; step++) {
    await page.clock.fastForward("00:30:00");
    await page.waitForTimeout(500);
  }
  await expect(prompt).toBeVisible();
  return prompt;
}

// S26.3: a guest is asked to keep their key once their airline has flown.
test("a guest is prompted to back up the key after the first landing", async ({
  page,
  problems,
}) => {
  test.setTimeout(240_000);
  const prompt = await flyFirstFlight(page, {
    signUp: () => createAirline(page),
    launchLabel: /launch route with/i,
    confirmLabel: /^launch$/i,
    liveText: /MAD → BCN is live/,
  });
  await expect(prompt).toHaveAttribute("data-moment", "landing");
  await expect(prompt).toContainText("Your first flight landed");
  await shot(page, "key-backup-prompt-en.png");

  // One tap downloads the key file and the prompt goes away for good.
  const download = page.waitForEvent("download");
  await prompt.getByRole("button", { name: /download/i }).click();
  expect((await download).suggestedFilename()).toBe("acars-secret-key.txt");
  await expect(prompt).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
});

test("the prompt speaks Spanish and can wait", async ({ page, problems }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem("acars-language", "es"));
  const prompt = await flyFirstFlight(page, {
    // The shared helper speaks English; the same steps in Spanish.
    signUp: async () => {
      await gotoReady(page, "/join");
      await page.getByRole("button", { name: /juega gratis/i }).click();
      await page.locator("#airline-name").fill("E2E Air");
      await page.getByRole("button", { name: /lanzar aerolínea/i }).click();
      await expect(page.locator("#airline-name")).toHaveCount(0, { timeout: 60_000 });
    },
    launchLabel: /lanzar ruta con/i,
    confirmLabel: /^lanzar$/i,
    liveText: /MAD → BCN ya opera/,
  });
  await expect(prompt).toContainText("Tu primer vuelo aterrizó");
  await shot(page, "key-backup-prompt-es.png");

  await prompt.getByRole("button", { name: "Ahora no" }).click();
  await expect(prompt).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
});
