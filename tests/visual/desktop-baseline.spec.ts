import { expect, test, type Page } from "@playwright/test";

const screenshotOptions = {
  animations: "disabled" as const,
  caret: "hide" as const,
  maskColor: "#d9d4c8",
};
const strictComparison = process.env.RESPONSIVE_VISUAL_STRICT === "1";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("운영자 이메일").fill("scout@example.com");
  await page.getByLabel("비밀번호").fill("cafe-scout-local");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/visits$/);
}

async function expectStableScreenshot(page: Page, name: string, maxDiffPixels = 0) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await expect(page).toHaveScreenshot(name, {
    ...screenshotOptions,
    mask: [page.locator('input[type="datetime-local"]')],
    maxDiffPixels: strictComparison ? 0 : maxDiffPixels,
  });
}

test("public desktop baseline", async ({ page }) => {
  await page.goto("/");
  await expectStableScreenshot(page, "desktop-home.png");
  await page.goto("/login");
  await expectStableScreenshot(page, "desktop-login.png");
});

const authenticatedStates = [
  { name: "desktop-visits.png", path: "/visits", maxDiffPixels: 900 },
  { name: "desktop-form.png", path: "/visits/new", maxDiffPixels: 8_500 },
  {
    name: "desktop-detail.png",
    path: "/visits/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    maxDiffPixels: 1_400,
  },
  {
    name: "desktop-compare.png",
    path: "/visits/compare?ids=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    maxDiffPixels: 900,
  },
] as const;

for (const state of authenticatedStates) {
  test(`authenticated ${state.name}`, async ({ page }) => {
    await login(page);
    await page.goto(state.path);
    await expectStableScreenshot(page, state.name, state.maxDiffPixels);
  });
}
