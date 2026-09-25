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
  "dispatch",
  "results",
  "settings",
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

test("construction mode opens field-based home and role menus", async ({ page }) => {
  await page.goto("/?preview=app&role=construction&page=transport");
  await expect(page.getByLabel("事業モード")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "現場別" })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: "搬出管理", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "運行ダッシュボード", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "配車・運行管理", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "入退場管理", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "発生土マッチ", exact: true })).toHaveCount(1);
  await expect(page.getByText("本日の予定便数")).toBeVisible();
  await expect(page.getByLabel("運行予定の集計").getByText("実車両数")).toBeVisible();
  await expect(page.getByLabel("運行予定の集計").getByText("伝票確認待ち")).toBeVisible();
  await page.getByRole("button", { name: /未手配/ }).last().click();
  await expect(page.getByLabel("運行状態")).toHaveValue("未手配");
  await expect(page.getByRole("button", { name: "予定を作る" })).toBeVisible();
});

test("construction dispatch makes only a local prototype assignment", async ({ page }) => {
  await page.goto("/?preview=app&role=construction&page=dispatch");
  await expect(page.getByText("API未接続のため、割当・変更内容はこの画面を閉じると失われます。")).toBeVisible();
  await page.getByRole("button", { name: /TR-20260820-02/ }).click();
  await page.getByRole("button", { name: "サンプル車両を仮割当" }).click();
  await expect(page.getByRole("dialog")).toContainText("保存されていません");
});

test("construction weekly copy requires review and remains a local draft", async ({ page }) => {
  await page.goto("/?preview=app&role=construction&page=dispatch");
  await page.getByRole("tab", { name: "前日・前週からコピー" }).click();
  const apply = page.getByRole("button", { name: "確認して下書きへ反映" });
  await expect(apply).toBeDisabled();
  await page.getByLabel("保存対象の日付・4便を確認しました").check();
  await apply.click();
  await expect(page.getByRole("dialog")).toContainText("配車確定はしていません");
});

test("vehicle list opens driver information from each vehicle", async ({ page }) => {
  await page.goto("/?preview=app&role=construction&page=vehicles");
  await expect(page.getByRole("button", { name: "運転手情報", exact: true })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "運転手情報" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "運転手情報" }).nth(1)).toBeVisible();
  await expect(page.getByRole("button", { name: "運転手情報" }).nth(2)).toBeVisible();
  await expect(page.getByRole("button", { name: "運転手情報" }).nth(3)).toHaveCount(0);
  await expect(page.getByText("運転手情報は、各車両")).toBeVisible();
  await page.getByRole("button", { name: "運転手情報" }).first().click();
  await expect(page.getByRole("dialog", { name: "10t ダンプ 01の運転手情報" })).toContainText("サンプル 運転者1");
});

test("matching detail visualizes sample compatibility as a graph", async ({ page }) => {
  await page.goto("/?preview=app&role=construction&page=matching");
  await expect(page.getByRole("img", { name: "適合度の項目別サンプルグラフ" })).toBeVisible();
  await expect(page.getByLabel("サンプル適合度 94点")).toBeVisible();
  await expect(page.getByText("実計算ではありません")).toBeVisible();
  await expect(page.getByText("土質", { exact: true }).last()).toBeVisible();
});

test("control timeline expands and draft scheduling does not claim persistence", async ({ page }) => {
  await page.goto("/?preview=app&role=construction&page=control");
  await expect(page.getByRole("button", { name: "地図と並べる" })).toBeVisible();
  await expect(page.getByText("便を選ぶと走行経路を地図で表示します")).toBeVisible();
  await page.getByRole("button", { name: /08:05 D-103/ }).click();
  await expect(page.getByLabel("インタラクティブ運行マップ")).toBeVisible();
  await expect(page.getByText("通過済み経路", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "タイムラインをメイン表示" })).toBeVisible();
  await page.getByRole("button", { name: "予定を追加" }).click();
  await page.getByRole("button", { name: "予定案を下書きへ反映" }).click();
  await expect(page.getByRole("dialog")).toContainText("保存・確定はしていません");
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
