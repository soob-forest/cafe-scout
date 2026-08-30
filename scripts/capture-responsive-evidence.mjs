#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const viewports = [
  { name: "minimum", width: 320, height: 720 },
  { name: "mobile", width: 360, height: 800 },
  { name: "mobile-large", width: 412, height: 915 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

const publicStates = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
];

const authenticatedStates = [
  { name: "visits", path: "/visits" },
  { name: "form", path: "/visits/new" },
  { name: "detail", path: "/visits/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1" },
  {
    name: "compare",
    path: "/visits/compare?ids=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
  },
];

function parseArguments() {
  const [rawBaseURL, label] = process.argv.slice(2);
  if (!rawBaseURL || !label)
    throw new Error("Usage: capture-responsive-evidence.mjs <local-base-url> <before|after>");
  const baseURL = new URL(rawBaseURL);
  if (!["localhost", "127.0.0.1"].includes(baseURL.hostname) || !/^https?:$/.test(baseURL.protocol))
    throw new Error("Evidence capture is restricted to a local HTTP(S) server.");
  if (!/^(before|after)$/.test(label)) throw new Error("Evidence label must be 'before' or 'after'.");
  return { baseURL: baseURL.origin, label };
}

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("운영자 이메일").fill("scout@example.com");
  await page.getByLabel("비밀번호").fill("cafe-scout-local");
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(/\/visits$/);
}

async function captureState(page, outputDirectory, viewport, state) {
  await page.goto(state.path);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.evaluate(() => window.scrollTo(0, 0));
  const filename = `${viewport.name}-${state.name}.png`;
  await page.screenshot({
    path: resolve(outputDirectory, filename),
    animations: "disabled",
    caret: "hide",
    mask: [page.locator('input[type="datetime-local"]')],
    maskColor: "#d9d4c8",
  });
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  return { filename, path: state.path, viewport, ...dimensions };
}

async function captureViewport(browser, baseURL, outputDirectory, viewport) {
  const context = await browser.newContext({
    baseURL,
    viewport,
    colorScheme: "light",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  const page = await context.newPage();
  const captures = [];
  try {
    for (const state of publicStates)
      captures.push(await captureState(page, outputDirectory, viewport, state));
    await login(page);
    for (const state of authenticatedStates)
      captures.push(await captureState(page, outputDirectory, viewport, state));
    return captures;
  } finally {
    await context.close();
  }
}

async function run() {
  const { baseURL, label } = parseArguments();
  const outputDirectory = resolve("artifacts", "responsive-evidence", label);
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch();
  const captures = [];
  try {
    for (const viewport of viewports)
      captures.push(...(await captureViewport(browser, baseURL, outputDirectory, viewport)));
  } finally {
    await browser.close();
  }
  const manifest = { label, baseURL, captures };
  await writeFile(resolve(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Captured ${captures.length} ${label} screenshots in ${outputDirectory}.\n`);
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Evidence capture failed."}\n`);
  process.exitCode = 1;
});
