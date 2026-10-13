import { expect, test } from "./fixtures";
import { launchRoute } from "./journeys";
import { continuePastDelivery, stubLivery } from "./livery";
import { sharedRelay } from "./sharedRelay";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

// Polish pass (overhaul S77): what a scripted playtest found, kept fixed.

test("a new player launches from the opportunities with a plane, and sees what it does", async ({
  page,
  problems,
}) => {
  test.setTimeout(180_000);
  await page.clock.install();
  await stubLivery(page);
  await createAirline(page);

  await navigateInApp(page, "/?panel=cockpit");
  const checklist = page.getByTestId("first-hour-checklist");
  await expect(checklist).toBeVisible({ timeout: 30_000 });
  await checklist.getByRole("link", { name: /find a route/i }).click();
  await expect(page).toHaveURL(/\/network\?tab=opportunities/);

  // The button launches a route with its plane, not a bare $100,000 route.
  const launch = page.getByTestId("opportunity-launch").first();
  await expect(launch).toHaveText(/launch route/i, { timeout: 30_000 });
  await page.screenshot({ path: "test-results/polish-opportunities.png" });
  await launch.click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(/lease deposit/i);
  await page.screenshot({ path: "test-results/polish-opportunity-confirm.png" });
  await confirm.getByRole("button", { name: /^launch$/i }).click();
  await expect(page.getByText(/is live/).first()).toBeVisible({ timeout: 30_000 });

  await page.clock.fastForward("00:05:00");
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(400);
    await continuePastDelivery(page);
  }

  // The fleet says plainly what the plane does.
  await navigateInApp(page, "/fleet");
  const duty = page.getByTestId("aircraft-duty").first();
  await expect(duty).toContainText(/^Flies MAD ⇄ [A-Z]{3} back and forth$/, { timeout: 30_000 });
  await expect(page.getByText(/^Registration$/i).first()).toBeVisible();
  await page.screenshot({ path: "test-results/polish-fleet-duty.png" });
  expect(problems.pageErrors).toEqual([]);
});

test("a confirm never outlives the page that asked it", async ({ page, problems }) => {
  test.setTimeout(120_000);
  await createAirline(page);
  await navigateInApp(page, "/network?tab=opportunities");
  await page.getByTestId("opportunity-launch").first().click();
  await expect(page.getByRole("alertdialog")).toBeVisible();

  await navigateInApp(page, "/airport/BCN");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(page.getByTestId("route-decision-card")).toBeVisible({ timeout: 30_000 });
  expect(problems.pageErrors).toEqual([]);
});

test("after a reload the player's airline is counted once, not as its own rival", async ({
  page,
  problems,
}) => {
  test.setTimeout(300_000);
  const relay = sharedRelay();
  await relay.attach(page);
  await page.clock.install();
  await stubLivery(page);
  await createAirline(page);
  await launchRoute(page, "BCN");
  const airlines = page.getByTestId("ticker-airlines");
  await expect(airlines).toHaveText("1", { timeout: 30_000 });
  // Fly until the airline's snapshot is on the relay: a reload's world sync finds it.
  const hasSnapshot = () =>
    relay
      .published()
      .some((event) => event.tags.some((tag) => tag[0] === "d" && tag[1]?.endsWith(":snapshot")));
  for (let step = 0; step < 12 && !hasSnapshot(); step++) {
    await page.clock.fastForward("00:20:00");
    await page.waitForTimeout(500);
    await continuePastDelivery(page);
  }
  expect(hasSnapshot()).toBe(true);

  await page.reload();
  await expect(page.getByTestId("ticker-cash-today")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(5_000);
  await expect(airlines).toHaveText("1");
  expect(problems.pageErrors).toEqual([]);
});

// S78: one clear screen at a time.
test("a new airline's cockpit opens on its checklist, under plain chrome", async ({
  page,
  problems,
}) => {
  test.setTimeout(120_000);
  await createAirline(page);
  await navigateInApp(page, "/?panel=cockpit");
  const checklist = page.getByTestId("first-hour-checklist");
  await expect(checklist).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Cockpit" })).toBeVisible();
  // Nothing has flown: no empty gauges, no second "open a route" prompt.
  await expect(page.getByText("Utilization")).toHaveCount(0);
  await expect(page.getByTestId("cockpit-needs-you")).toHaveCount(0);
  // The top bar says what the next tier needs, in words.
  await expect(page.getByTestId("topbar-tier-next").last()).toHaveText(/more routes?/);
  await page.screenshot({ path: "test-results/fresh-cockpit.png" });

  await navigateInApp(page, "/info");
  await expect(page.getByTestId("how-to-play")).toContainText("Pick a route");
  await page.screenshot({ path: "test-results/fresh-info.png" });
  expect(problems.pageErrors).toEqual([]);
});
