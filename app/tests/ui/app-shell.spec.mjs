import { expect, test } from "@playwright/test";

const routes = [
  "fields",
  "matching",
  "control",
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
  for (const name of ["入退場管理", "調整会議"]) {
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "発生土マッチ", exact: true })).toHaveCount(1);
  await expect(page.getByLabel("搬出管理の対象日")).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("button", { name: /有効な予定便/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /搬出済み・受入未完了/ })).toBeVisible();
  await expect(page.getByText(/累計受入確定/).first()).toBeVisible();
  await page.getByRole("button", { name: /未搬出便/ }).click();
  await expect(page.locator(".construction-progress-grid").getByRole("button", { name: /未搬出便/ })).toHaveClass(/active/);
  await expect(page.getByRole("button", { name: "搬出実績を見る" })).toBeVisible();
});

test("construction dispatch shares a reasoned local assignment without claiming API delivery", async ({ page }) => {
 await page.goto("/?preview=app&role=construction&page=dispatch");
 await page.getByRole('row').filter({hasText:'TR-20260820-04'}).getByRole('button').click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('車両',{exact:true}).selectOption({index:1});
 await dialog.getByLabel('ドライバー',{exact:true}).selectOption({index:1});
 await dialog.getByLabel('変更・取消理由').fill('検証用の割当');
 await dialog.getByRole('button',{name:'変更をデモ内に反映（未送信）'}).click();
 await expect(page.getByRole('row').filter({hasText:'TR-20260820-04'})).toContainText('成田 100 を 01-01');
 await expect(page.locator('.compact-demo-notice')).toContainText('変更は未送信');
 await page.locator('.compact-demo-notice summary').click();
 await expect(page.getByText(/相手への送信・API／DB保存は行いません/)).toBeVisible();
});

test("construction copy requires review, drops actuals and prevents duplicate date copy", async ({page})=>{
 await page.goto("/?preview=app&role=construction&page=dispatch");
 await page.getByRole('tab',{name:'前日・前週からコピー'}).click();
 const apply=page.getByRole('button',{name:'確認して下書きへ反映'});
 await expect(apply).toBeDisabled();
 await page.getByLabel('対象日・便・受入先を確認しました').check();await apply.click();
 await expect(page.locator('.dispatch-page [role=status]')).toContainText('5便');
 await expect(page.getByText(/実績・伝票・確認状態は引き継ぎません/)).toBeVisible();
});

test("vehicle history preserves the driver and plate snapshot",async({page})=>{
 await page.goto("/?preview=app&role=construction&page=vehicles");
 await expect(page.getByRole('button',{name:'運転手情報・履歴'})).toHaveCount(3);
 await page.getByRole('button',{name:'運転手情報・履歴'}).first().click();
 await expect(page.getByRole('dialog')).toContainText('青木 太郎');
 await expect(page.getByRole('dialog')).toContainText('車両の当日2便目');
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
  await page.getByRole("button", { name: /09:10 TR-20260820-02/ }).click();
  await expect(page.getByLabel("インタラクティブ運行マップ")).toBeVisible();
  await expect(page.getByText("通過済み経路", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "タイムラインをメイン表示" })).toBeVisible();
  await page.getByRole("button", { name: "予定を追加" }).click();
  await expect(page.getByRole("heading", { name: "配車・運行管理",exact:true }).last()).toBeVisible();
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

// Old bookmarks must open a usable role home rather than retired products.
for (const role of ["construction", "receiving"]) {
  test(`retired service bookmarks fall back to ${role} home`, async ({ page }) => {
    for (const route of role === "receiving" ? ["labor", "gatekeeper", "conference"] : ["gatekeeper", "conference"]) {
      await page.goto(`/?preview=app&role=${role}&page=${route}`);
      await expect(page.locator(".page-header h1")).toHaveText(role === "construction" ? "搬出管理" : "受入管理〈ホーム〉");
      await expect(page.locator(".service-product, .gf-page")).toHaveCount(0);
      for (const name of ["入退場管理", "調整会議"]) {
        await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
      }
    }
  });
}

for (const theme of ["light", "dark"]) {
  for (const width of [1440, 390]) {
    test(`restored labor keeps retained menus in ${theme} at ${width}`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("ecodump-theme", value), theme);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/?preview=app&role=construction&page=labor");
      await expect(page.locator(".page-header h1")).toHaveText("労務安全");
      const menu = page.locator(".service-menu");
      await expect(menu.getByRole("button")).toHaveCount(4);
      for (const name of ["新規入場時等教育実施報告書", "【元請会社】新規入場者調査票", "その他の安全書類", "是正依頼内容の確認・返信", "書類一括出力", "共通メニュー", "現場掲示板"]) {
        await expect(menu.getByRole("button", {name, exact: true})).toHaveCount(0);
      }
      for (const category of ["一括提出書類", "個別提出書類", "許可情報", "契約情報", "保険加入証明書", "主任技術者"]) {
        await page.locator(".gf-tabs").getByRole("button", {name: category, exact:true}).click();
        await expect(page.locator(".gf-tabs").getByRole("button", {name:category, exact:true})).toHaveClass(/active/);
      }
      for (const name of ["元請帳票の確認", "配下協力会社検索"]) {
        await menu.getByRole("button", {name, exact:true}).click();
        await expect(page.locator(".service-main h2")).toHaveText(name);
      }
      await menu.getByRole("button", {name:"ドライバー検索", exact:true}).click();
      await page.getByRole("textbox", {name:"検索", exact:true}).fill("佐藤");
      await expect(page.locator(".driver-search-page [role=status]")).toHaveText("検索結果：1件");
      await expect(page.locator(".service-main")).not.toContainText("送り出し教育");
      await menu.getByRole("button", {name:"書類状況一覧", exact:true}).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    });
  }
}
