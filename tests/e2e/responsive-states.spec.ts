import { expect, test, type Page } from "@playwright/test";

const primaryVisitId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const incompleteVisitId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3";
const mobileViewport = { width: 360, height: 800 };

async function login(page: Page, email = "scout@example.com") {
  await page.goto("/login");
  await page.getByLabel("운영자 이메일").fill(email);
  await page.getByLabel("비밀번호").fill("cafe-scout-local");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/visits$/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function installAppStateFixture(page: Page, state: "loading" | "error") {
  await page.waitForLoadState("networkidle");
  await page.evaluate((fixtureState) => {
    const main = document.querySelector("main");
    if (!main) throw new Error("앱 상태 fixture를 배치할 main을 찾지 못했습니다.");
    main.className = "page-shell";
    main.innerHTML =
      fixtureState === "loading"
        ? '<div class="page-heading skeleton-block"></div><div class="visit-grid"><div class="visit-card skeleton-card"></div><div class="visit-card skeleton-card"></div><div class="visit-card skeleton-card"></div></div><span class="sr-only">방문 기록을 불러오는 중입니다.</span>'
        : '<section class="error-state" role="alert"><p class="eyebrow">CONNECTION INTERRUPTED</p><h1>기록을 불러오지 못했습니다.</h1><p>네트워크 연결이나 Supabase 프로젝트 상태를 확인한 뒤 다시 시도해 주세요.</p><button class="primary-button" type="button">다시 시도</button></section>';
  }, state);
}

async function installPortraitLightboxFixture(page: Page) {
  await page.evaluate(() => {
    const lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.setAttribute("role", "dialog");
    lightbox.innerHTML =
      '<button type="button" aria-label="확대 보기 닫기">×</button><img alt="고해상도 세로 사진" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221600%22 height=%223200%22%3E%3Crect width=%221600%22 height=%223200%22 fill=%22%23183d2c%22/%3E%3C/svg%3E">';
    document.body.append(lightbox);
  });
}

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop"));

test("breakpoint transitions remain continuous around 767 and 1024 pixels", async ({ page }) => {
  await login(page);
  await page.goto("/visits/new");
  const widths = [
    ...Array.from({ length: 9 }, (_, index) => 763 + index),
    ...Array.from({ length: 9 }, (_, index) => 1019 + index),
  ];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoPageOverflow(page);
    const position = await page
      .locator(".estimate-sidebar")
      .evaluate((element) => window.getComputedStyle(element).position);
    expect(position).toBe(width <= 767 ? "fixed" : "sticky");
  }
});

test("empty, loading, error and cleanup states fit supported widths", async ({ page }) => {
  await login(page, "isolation@example.com");
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/visits");
    await expect(page.getByRole("heading", { name: "첫 카페를 관찰해 보세요." })).toBeVisible();
    await expectNoPageOverflow(page);
    for (const state of ["loading", "error"] as const) {
      await installAppStateFixture(page, state);
      await expectNoPageOverflow(page);
      await page.goto("/visits");
    }
  }
  await logout(page);
  await login(page);
  await page.goto("/visits?cleanup=pending");
  await expect(page.getByText("일부 사진 object 정리가 지연되었습니다.")).toBeVisible();
  await expectNoPageOverflow(page);
});

test("fallback details and invalid comparisons remain readable on mobile", async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await login(page);
  await page.goto(`/visits/${incompleteVisitId}`);
  await expect(page.getByText("매출 추정 불가")).toBeVisible();
  await expect(page.getByText("저장된 사진이 없습니다.")).toBeVisible();
  await expect(page.getByText("아직 추가 관찰이 없습니다.")).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto(`/visits/compare?ids=${primaryVisitId},${primaryVisitId}`);
  await expect(page.getByRole("heading", { name: "비교할 수 없습니다." })).toBeVisible();
  await expectNoPageOverflow(page);
  await logout(page);
  await login(page, "isolation@example.com");
  await page.goto(`/visits/compare?ids=${primaryVisitId},bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2`);
  await expect(page.getByText("비교할 수 없는 방문 기록이 포함되어 있습니다.")).toBeVisible();
  await expectNoPageOverflow(page);
});

test("observation transport failures keep mobile input and records visible", async ({ page }) => {
  await page.setViewportSize(mobileViewport);
  await login(page);
  await page.goto(`/visits/${incompleteVisitId}`);
  await page.route(`**/visits/${incompleteVisitId}*`, async (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 503, body: "unavailable" });
    await route.continue();
  });
  await page.getByRole("spinbutton", { name: "점유율" }).fill("50");
  await page.getByRole("button", { name: "관찰 추가" }).click();
  await expect(page.locator(".observation-manager .form-error")).toContainText("연결이 끊겼습니다");
  await expect(page.getByRole("spinbutton", { name: "점유율" })).toHaveValue("50");

  await page.goto(`/visits/${primaryVisitId}`);
  await page.route(`**/visits/${primaryVisitId}*`, async (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 503, body: "unavailable" });
    await route.continue();
  });
  await page
    .locator(".observation-list")
    .getByRole("button", { name: /관찰 삭제/ })
    .first()
    .click();
  await expect(page.locator(".observation-manager .form-error")).toContainText("관찰을 삭제하지 못했습니다");
  await expect(page.locator(".observation-list li")).toHaveCount(2);
  await expectNoPageOverflow(page);
});

test("keyboard paths and portrait lightbox stay usable in landscape", async ({ page, browserName }) => {
  await page.setViewportSize(mobileViewport);
  await login(page);
  const navigation = page.getByRole("navigation", { name: "주요 메뉴" });
  await navigation.getByRole("link", { name: "방문 기록", exact: true }).focus();
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(navigation.getByRole("link", { name: "새 기록", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/visits\/new$/);
  await page.getByLabel("카페명").focus();
  await page.keyboard.type("키보드 접근 카페");
  await page.keyboard.press("Tab");
  await page.keyboard.type("키보드 지역");
  await expect(page.getByLabel("지역")).toHaveValue("키보드 지역");

  await page.setViewportSize({ width: 844, height: 390 });
  await installPortraitLightboxFixture(page);
  const image = await page.getByAltText("고해상도 세로 사진").boundingBox();
  const close = await page.getByRole("button", { name: "확대 보기 닫기" }).boundingBox();
  expect(image?.height).toBeLessThanOrEqual(390);
  expect(image?.width).toBeLessThanOrEqual(844);
  expect(close?.width).toBeGreaterThanOrEqual(44);
  expect(close?.height).toBeGreaterThanOrEqual(44);
  await expectNoPageOverflow(page);
});

test("effective 200 percent zoom reflows without page overflow", async ({ page }) => {
  await login(page);
  for (const viewport of [
    { width: 640, height: 720 },
    { width: 720, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/visits",
      "/visits/new",
      `/visits/${primaryVisitId}`,
      `/visits/compare?ids=${primaryVisitId},bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2`,
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoPageOverflow(page);
      await expect(page.locator("main").last()).toBeVisible();
    }
  }
});
