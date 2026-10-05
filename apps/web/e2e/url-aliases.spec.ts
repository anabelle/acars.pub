import { expect, gotoReady, test } from "./fixtures";

// One name per place (overhaul S22.1): the URLs that match the nav names
// redirect to the canonical pages, keeping their search params.
const ALIASES = [
  { from: "/routes?tab=opportunities", to: /\/network\?tab=opportunities$/ },
  { from: "/rivals", to: /\/leaderboard$/ },
  { from: "/finance?section=hubs", to: /\/corporate\?section=hubs$/ },
  { from: "/info", to: /\/about$/ },
];

for (const { from, to } of ALIASES) {
  test(`${from} redirects to its canonical page`, async ({ page, problems }) => {
    await gotoReady(page, from);
    await expect(page).toHaveURL(to);
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    expect(problems.pageErrors).toEqual([]);
  });
}
