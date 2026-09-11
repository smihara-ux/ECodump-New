import { expect, test } from "@playwright/test";

const routes = [
  "fields",
  "matching",
  "control",
  "labor",
  "gatekeeper",
  "conference",
  "transport",
  "company",
  "users",
  "vehicles",
  "agencies",
  "agency-request",
  "prime-contractors",
  "field&fieldId=32182",
];

for (const theme of ["light", "dark"]) {
  for (const route of routes) {
    test(`${route} renders without overflow in ${theme} mode`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("ecodump-theme", selectedTheme);
      }, theme);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/?preview=app&page=${route}`);
      await expect(page.locator(".app-shell")).toBeVisible();
      await expect(page.locator(".content")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
    });
  }
}

for (const viewport of [
  { name: "tablet", width: 1024, height: 768 },
  { name: "phone", width: 390, height: 844 },
]) {
  for (const route of ["fields", "control", "field&fieldId=32182"]) {
    test(`${route} keeps primary UI reachable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/?preview=app&page=${route}`);
      await expect(page.locator(".content")).toBeVisible();
      if (viewport.name === "phone") {
        await expect(page.locator(".mobile-menu")).toBeVisible();
      } else {
        await expect(page.locator(".sidebar .collapse")).toBeVisible();
      }
      const unlabeledButtons = await page.locator("button").evaluateAll((buttons) =>
        buttons.filter((button) => {
          const label = button.getAttribute("aria-label") || button.title || button.textContent;
          return !label?.trim();
        }).length,
      );
      expect(unlabeledButtons).toBe(0);
    });
  }
}

test("login validation identifies and focuses the first invalid field", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  const company = page.locator("#login-company");
  await expect(company).toBeFocused();
  await expect(company).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").first()).toBeVisible();
});

test("demo login and theme toggle complete the primary entry flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /ダークモードに切り替え/ }).click();
  await expect(page.locator(".login-screen")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: /テスト用ログイン/ }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
});

test("field table is keyboard reachable", async ({ page }) => {
  await page.goto("/?preview=app&page=fields");
  const tableRegion = page.getByRole("region", { name: /現場一覧/ });
  await expect(tableRegion).toBeVisible();
  await tableRegion.focus();
  await expect(tableRegion).toBeFocused();
});

test("list data exports CSV", async ({ page }) => {
  await page.goto("/?preview=app&page=users");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "表示データをCSV出力" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});

test("notification read state persists after reload", async ({ page }) => {
  await page.goto("/?preview=app&page=fields");
  await page.getByRole("button", { name: "通知", exact: true }).first().click();
  await page.getByRole("button", { name: "すべて既読" }).click();
  await page.reload();
  await page.getByRole("button", { name: "通知", exact: true }).first().click();
  await expect(page.getByText("未読 0件")).toBeVisible();
});

test("release metadata and manifest are exposed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
});

test("detail search is keyboard-contained and closes with Escape", async ({ page }) => {
  await page.goto("/?preview=app&page=fields");
  await page.getByRole("button", { name: "詳細検索" }).click();
  const dialog = page.getByRole("dialog", { name: "詳細検索" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

for (const route of routes) {
  test(`${route} does not clip the document at compact desktop width`, async ({ page }) => {
    await page.setViewportSize({ width: 1088, height: 900 });
    await page.goto(`/?preview=app&page=${route}`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
}
