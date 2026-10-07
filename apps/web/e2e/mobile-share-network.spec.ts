import { expect, test } from "./fixtures";
import { createAirline, MADRID_PLAYER, navigateInApp } from "./signup";

test.use(MADRID_PLAYER);

/** A share sheet that accepts files and records what it was given. */
const FAKE_SHARE_SHEET = () => {
  const shared: Array<{
    title?: string;
    url?: string;
    files: Array<{ name: string; type: string; size: number }>;
  }> = [];
  (window as unknown as { __shared: typeof shared }).__shared = shared;
  Object.defineProperty(navigator, "canShare", {
    value: (data: ShareData) => Boolean(data.files?.length),
    configurable: true,
  });
  Object.defineProperty(navigator, "share", {
    value: async (data: ShareData) => {
      shared.push({
        title: data.title,
        url: data.url,
        files: (data.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })),
      });
    },
    configurable: true,
  });
};

// S51 on mobile: the share sheet gets the network image and the public link.
test("mobile: share my network sends the image and the link to the share sheet", async ({
  page,
  problems,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(FAKE_SHARE_SHEET);
  await createAirline(page);
  await navigateInApp(page, "/?panel=cockpit");

  await page.getByTestId("share-network").click();
  await expect
    .poll(
      () => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length),
      { timeout: 30_000 },
    )
    .toBe(1);
  const [shared] = await page.evaluate(
    () =>
      (
        window as unknown as {
          __shared: Array<{
            title?: string;
            url?: string;
            files: Array<{ name: string; type: string; size: number }>;
          }>;
        }
      ).__shared,
  );
  expect(shared.title).toMatch(/on ACARS$/);
  expect(shared.url).toMatch(/\/airline\/(npub1[0-9a-z]+)\?ref=\1$/);
  expect(shared.files).toHaveLength(1);
  expect(shared.files[0]).toMatchObject({ type: "image/png" });
  expect(shared.files[0].name).toMatch(/-network\.png$/);
  expect(shared.files[0].size).toBeGreaterThan(1000);

  expect(problems.pageErrors).toEqual([]);
});
