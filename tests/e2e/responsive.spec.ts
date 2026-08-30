import { expect, test, type Page, type TestInfo } from "@playwright/test";

const viewports = [
  { name: "minimum", width: 320, height: 720 },
  { name: "mobile", width: 360, height: 800 },
  { name: "mobile-large", width: 412, height: 915 },
  { name: "mobile-boundary", width: 767, height: 900 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-boundary", width: 1023, height: 900 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("운영자 이메일").fill("scout@example.com");
  await page.getByLabel("비밀번호").fill("cafe-scout-local");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/visits$/);
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function attachScreen(page: Page, testInfo: TestInfo, name: string) {
  await page.waitForLoadState("networkidle");
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function expectTargetsAtLeast(page: Page, selector: string, size = 44) {
  const undersized = await page.locator(selector).evaluateAll(
    (elements, minimum) =>
      elements
        .filter((element) => {
          const style = window.getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .map((element) => {
          const box = element.getBoundingClientRect();
          return { label: element.getAttribute("aria-label") ?? element.textContent?.trim(), box };
        })
        .filter(({ box }) => box.width < minimum || box.height < minimum),
    size,
  );
  expect(undersized).toEqual([]);
}

async function mobileFixedActionBoxes(page: Page) {
  const [nav, estimate, heading] = await Promise.all([
    page.getByRole("navigation", { name: "주요 메뉴" }).boundingBox(),
    page.locator(".estimate-card").boundingBox(),
    page.locator(".form-heading").boundingBox(),
  ]);
  if (!nav || !estimate || !heading) throw new Error("모바일 고정 요소의 위치를 측정하지 못했습니다.");
  return { nav, estimate, heading };
}

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop"));

test("public pages stay within every supported viewport", async ({ page }, testInfo) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/login"]) {
      await page.goto(path);
      await expectNoPageOverflow(page);
    }
    if (["mobile", "tablet-portrait", "desktop"].includes(viewport.name))
      await attachScreen(page, testInfo, `login-${viewport.name}`);
  }
});

test("app shell and core pages avoid unintended overflow", async ({ page }, testInfo) => {
  await login(page);
  const paths = [
    "/visits",
    "/visits/new",
    "/visits/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    "/visits/compare?ids=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const path of paths) {
      await page.goto(path);
      await expectNoPageOverflow(page);
    }
    await page.goto("/visits/new");
    if (["mobile", "tablet-portrait", "desktop"].includes(viewport.name))
      await attachScreen(page, testInfo, `visit-form-${viewport.name}`);
  }
});

test("mobile fixed actions remain usable without overlapping", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.goto("/visits/new");
  await expect(page.getByRole("heading", { name: "새 방문 기록" })).toBeVisible();
  const { nav, estimate, heading } = await mobileFixedActionBoxes(page);
  expect(estimate.y).toBeGreaterThan(heading.y + heading.height);
  expect(estimate.y + estimate.height).toBeLessThanOrEqual(nav.y - 4);
  expect(nav.y - (estimate.y + estimate.height)).toBeLessThanOrEqual(24);
  await expectTargetsAtLeast(page, ".app-nav a, .estimate-sidebar .save-button");
  await expectTargetsAtLeast(
    page,
    ".segmented button, .chip-row button, .choice-grid button, .counter-field button, .quick-values button, .rating-field button",
  );

  await page.locator(".form-main input").first().focus();
  const saveButton = page.getByRole("button", { name: "저장", exact: true });
  const saveButtonReceivesPointer = await saveButton.evaluate((button) => {
    const box = button.getBoundingClientRect();
    const topmost = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return topmost === button || (topmost ? button.contains(topmost) : false);
  });
  expect(saveButtonReceivesPointer).toBe(true);
  await saveButton.click();
  const errorSummary = page.getByText("확인이 필요한 입력이 있습니다.");
  await expect(errorSummary).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.activeElement;
        return `${active?.id ?? ""} ${active?.className ?? ""}`;
      }),
    )
    .toMatch(/visit-|field-error-summary/);
  await expect(page.locator(":focus")).toBeInViewport();
});

test("tablet keeps the form and estimate side by side", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await login(page);
  await page.goto("/visits/new");
  await expect(page.getByRole("heading", { name: "새 방문 기록" })).toBeVisible();
  const main = await page.locator(".form-main").boundingBox();
  const estimate = await page.locator(".estimate-sidebar").boundingBox();
  expect(main).not.toBeNull();
  expect(estimate).not.toBeNull();
  expect(estimate?.x ?? 0).toBeGreaterThan((main?.x ?? 0) + (main?.width ?? 0));
  await expect(page.getByRole("heading", { name: "예상 매출" })).toBeVisible();
  await page.getByRole("button", { name: "메뉴 추가" }).click();
  await expectNoPageOverflow(page);
  await expectTargetsAtLeast(page, ".sort-controls button, .menu-row > .icon-button");
});

test("mobile maximum menus and photos keep touch controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.goto("/visits/new");
  const addMenu = page.getByRole("button", { name: "메뉴 추가" });
  for (let index = 0; index < 10; index += 1)
    await addMenu.evaluate((button: HTMLButtonElement) => button.click());
  await expect(addMenu).toBeDisabled();

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(
      Array.from({ length: 10 }, (_, index) => ({
        name: `responsive-${index}.png`,
        mimeType: "image/png",
        buffer: png,
      })),
    );
  await expect(page.getByAltText(/일반 사진 업로드 예정/)).toHaveCount(10);
  await page
    .locator('input[type="file"]')
    .nth(1)
    .setInputFiles(
      Array.from({ length: 3 }, (_, index) => ({
        name: `menu-${index}.png`,
        mimeType: "image/png",
        buffer: png,
      })),
    );
  await expect(page.getByAltText(/메뉴판 사진 업로드 예정/)).toHaveCount(3);
  await expectNoPageOverflow(page);
  await expectTargetsAtLeast(page, ".sort-controls button, .menu-row > .icon-button, .photo-controls button");
  const photoStrip = await page
    .locator(".photo-strip")
    .first()
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(photoStrip.scrollWidth).toBeGreaterThan(photoStrip.clientWidth);
});

test("reduced motion disables nonessential animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page
    .locator("body")
    .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThanOrEqual(0.001);
});

test("maximum-length detail content wraps at the minimum width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await login(page);
  await page.goto("/visits/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>(".detail-heading h1");
    const region = document.querySelector<HTMLElement>(".detail-heading p:last-child");
    const note = document.querySelector<HTMLElement>(".prose-block p");
    const menu = document.querySelector<HTMLElement>(".detail-menu-list strong");
    const metric = document.querySelector<HTMLElement>(".sales-highlight strong");
    if (heading) heading.textContent = "매우긴카페이름".repeat(12);
    if (region) region.append(" 매우긴지역이름".repeat(12));
    if (note) note.textContent = "긴 메모와 공백없는문자열".repeat(30);
    if (menu) menu.textContent = "매우긴대표메뉴이름".repeat(12);
    if (metric) metric.textContent = "₩999,999,999,999";
  });
  await expectNoPageOverflow(page);
  await expect(page.locator(".detail-heading h1")).toBeInViewport();

  await page.goto("/visits");
  await page
    .locator(".visit-card h2")
    .first()
    .evaluate((heading) => {
      heading.textContent = "공백없는매우긴카페카드이름".repeat(12);
    });
  await expectNoPageOverflow(page);
});

test("comparison keeps horizontal scrolling inside its own region", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.goto(
    "/visits/compare?ids=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
  );
  await expect(page.locator(".compare-scroll-hint")).toBeVisible();
  await expectNoPageOverflow(page);
  const dimensions = await page.locator(".compare-scroll").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  await page.locator(".compare-scroll").focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => page.locator(".compare-scroll").evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
});
