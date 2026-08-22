import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoAccessibilityViolations(page: Page) {
  const scan = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  expect(scan.violations).toEqual([]);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("운영자 이메일").fill("scout@example.com");
  await page.getByLabel("비밀번호").fill("cafe-scout-local");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/visits$/);
}

async function fillEstimateInputs(page: Page, cafeName: string) {
  await page.getByLabel("카페명").fill(cafeName);
  await page.getByLabel("지역").fill("E2E 지역");
  await page.getByLabel("관찰 시간").fill("30");
  await page.getByRole("spinbutton", { name: "테이블 수" }).fill("14");
  await page.getByRole("spinbutton", { name: "좌석 수" }).fill("40");
  await page.getByRole("spinbutton", { name: "현재 고객" }).fill("30");
  await page.getByRole("button", { name: "1.5시간", exact: true }).click();
  await page.locator("label").filter({ hasText: "예상 객단가" }).locator("input[type=number]").fill("9000");
  await page.getByLabel("오픈").fill("10:00");
  await page.getByLabel("마감").fill("22:00");
  await page.getByRole("button", { name: "거의 없음" }).click();
}

test("로그인부터 사진 재시도, 저장, 상세, 수정, 삭제까지 완료한다", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await login(page);
  const cafeName = `E2E ${testInfo.project.name} ${Date.now()}`;
  await page.goto("/visits/new");
  await fillEstimateInputs(page, cafeName);
  await expect(page.getByText("약 126만원")).toBeVisible();

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles([
      { name: "cafe-first.png", mimeType: "image/png", buffer: png },
      { name: "cafe-second.png", mimeType: "image/png", buffer: png },
    ]);
  await expect(page.getByAltText(/업로드 예정/)).toHaveCount(2);

  let firstBatchUploads = 0;
  await page.route("**/storage/v1/object/upload/sign/**", (route) => {
    firstBatchUploads += 1;
    if (firstBatchUploads === 2)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "simulated partial upload outage" }),
      });
    return route.continue();
  });
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText(/기록은 저장됐지만 사진 1장을 올리지 못했습니다/)).toBeVisible({
    timeout: 15_000,
  });

  let directUploadSeen = false;
  page.on("request", (request) => {
    if (
      request.url().includes("127.0.0.1:54321/storage/v1/object/upload/sign/") &&
      request.method() === "PUT"
    )
      directUploadSeen = true;
  });
  await page.unroute("**/storage/v1/object/upload/sign/**");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/visits\/[0-9a-f-]+$/);
  expect(directUploadSeen).toBe(true);
  await expect(page.getByRole("heading", { name: cafeName })).toBeVisible();
  await expect(page.getByText("BUSINESS SNAPSHOT")).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`${cafeName} 일반 사진`) })).toHaveCount(2);

  const observations = page.locator(".observation-manager");
  await observations.getByRole("spinbutton", { name: "현재 고객" }).fill("20");
  await observations.getByRole("button", { name: "관찰 추가" }).click();
  await expect(observations.getByText("50%", { exact: true })).toBeVisible();
  await observations.locator(".observation-list button").first().click();
  await observations.getByRole("spinbutton", { name: "현재 고객" }).fill("10");
  await observations.getByRole("button", { name: "관찰 수정", exact: true }).click();
  await expect(observations.getByText("25%", { exact: true })).toBeVisible();
  await observations.locator(".observation-list button").last().click();
  await expect(observations.getByText("아직 추가 관찰이 없습니다.")).toBeVisible();

  await page.getByRole("link", { name: "수정" }).click();
  await page.getByLabel("잘한 점").fill("E2E 수정 내용");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/visits\/[0-9a-f-]+$/);
  await expect(page.getByText("E2E 수정 내용")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "기록 삭제" }).click();
  await expect(page).toHaveURL(/\/visits(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: cafeName })).toHaveCount(0);
});

test("2~3개 기록을 선택 순서대로 비교하고 돌아온다", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "오후의 정원 비교 선택" }).click();
  await page.getByRole("button", { name: "모서리 로스터스 비교 선택" }).click();
  await page.getByRole("button", { name: /비교하기/ }).click();
  await expect(page).toHaveURL(/\/visits\/compare\?ids=/);
  await expect(page.getByRole("heading", { name: "방문 기록 비교" })).toBeVisible();
  const headers = page.locator(".compare-table thead th");
  await expect(headers.nth(1)).toContainText("오후의 정원");
  await expect(headers.nth(2)).toContainText("모서리 로스터스");
  await page.getByRole("link", { name: "선택으로 돌아가기" }).click();
  await expect(page).toHaveURL(/\/visits$/);
});

test("저장하지 않은 폼 이탈을 경고하고 로그아웃 세션을 차단한다", async ({ page }) => {
  await login(page);
  await page.goto("/visits/new");
  await page.getByLabel("카페명").fill("저장 전 이탈 테스트");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("저장하지 않은 변경사항");
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "방문 기록", exact: true }).click();
  await expect(page).toHaveURL(/\/visits\/new$/);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "방문 기록", exact: true }).click();
  await expect(page).toHaveURL(/\/visits$/);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/visits");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
});

test("폼 작성 중 세션 쿠키가 만료되면 데이터를 저장하지 않고 로그인으로 전환한다", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await login(page);
  const cafeName = `만료 세션 ${testInfo.project.name} ${Date.now()}`;
  await page.goto("/visits/new");
  await page.getByLabel("카페명").fill(cafeName);
  await page.getByLabel("지역").fill("세션 테스트 지역");

  await page.context().clearCookies();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);

  await login(page);
  await expect(page.getByRole("heading", { name: cafeName })).toHaveCount(0);

  await page.goto("/visits/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/edit");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const photoInput = page.locator('input[type="file"]').first();
  await expect(async () => {
    await photoInput.setInputFiles({ name: "expired-session.png", mimeType: "image/png", buffer: png });
    await expect(page.getByAltText(/업로드 예정/)).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  await page.context().clearCookies();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);

  await login(page);
  await page.goto("/visits/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1");
  await expect(page.getByText("저장된 사진이 없습니다.")).toBeVisible();
});

test("잘못된 비교 요청은 안전한 안내를 표시한다", async ({ page }) => {
  await login(page);
  await page.goto("/visits/compare?ids=not-a-uuid");
  await expect(page.getByRole("heading", { name: "비교할 수 없습니다." })).toBeVisible();
  await expect(page.getByText("서로 다른 방문 기록을 2~3개 선택해 주세요.")).toBeVisible();
});

test("핵심 화면에 자동 감지 접근성 위반이 없다", async ({ page }, testInfo) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 1, name: "방문 기록" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  if (testInfo.project.name === "mobile") {
    const navBox = await page.getByRole("navigation", { name: "주요 메뉴" }).boundingBox();
    expect(navBox?.y).toBeGreaterThan(700);
  }

  await page.goto("/visits/new");
  await expect(page.getByRole("heading", { level: 1, name: "새 방문 기록" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("확인이 필요한 입력이 있습니다.")).toBeVisible();
  await expect(page.getByLabel("카페명")).toHaveAttribute("aria-invalid", "true");
  await expectNoAccessibilityViolations(page);

  await page.goto("/visits/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1");
  await expect(page.getByRole("heading", { level: 1, name: "모서리 로스터스" })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.goto(
    "/visits/compare?ids=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  );
  await expect(page.getByRole("heading", { level: 1, name: "방문 기록 비교" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});
