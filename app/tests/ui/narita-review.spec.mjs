import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { demoDay } from "../../src/demo/model.mjs";
const construction = "/?preview=app&role=construction";
const receiving = "/?preview=app&role=receiving";
const evidence = fileURLToPath(
  new URL("../../../docs/frontend-review-2026-10-08/", import.meta.url),
);

test("現場Aの予定・実績・配車は同じ便だけ。便なし現場では代用しない", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${construction}&page=field&fieldId=32182`);
  await page.getByRole("button", { name: "搬出予定", exact: true }).click();
  await expect(page.getByLabel("搬出管理の対象日")).toHaveValue(demoDay());
  await expect(
    page.locator(".trip-row").filter({ hasText: "運行詳細" }),
  ).toHaveCount(3);
  await expect(page.locator(".construction-trip-list")).not.toContainText(
    "TR-20260820-02",
  );
  await page.getByRole("button", { name: "数量実績", exact: true }).click();
  await expect(page.locator(".results-table-wrap tbody tr")).toHaveCount(3);
  await expect(page.locator(".results-table-wrap")).toContainText("7.2 m³");
  await expect(page.locator(".results-table-wrap")).not.toContainText(
    "TR-20260820-02",
  );
  await page
    .getByRole("button", { name: "車両・運転手", exact: true })
    .last()
    .click();
  await expect(page.locator(".field-detail-page tbody tr")).toHaveCount(3);
  await expect(page.locator(".field-detail-page")).not.toContainText(
    "本日の配車",
  );
  await page.goto(`${construction}&page=field&fieldId=32184`);
  await page.getByRole("button", { name: "運行状況", exact: true }).click();
  await expect(
    page.getByText("選択した現場・対象日に運行予定はありません。"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("6カテゴリの項目と検索、仮提出・差戻し・再提出・元請確認の履歴", async ({
  page,
}) => {
  await page.goto(`${construction}&page=labor`);
  for (const [category, header] of [
    ["一括提出書類", "施工体制台帳"],
    ["個別提出書類", "車両情報"],
    ["許可情報", "運送事業許可情報"],
    ["契約情報", "運搬契約"],
    ["保険加入証明書", "自動車保険"],
    ["主任技術者", "資格証明"],
  ]) {
    await page.getByRole("button", { name: category, exact: true }).click();
    await expect(
      page.getByRole("columnheader", { name: header, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "許可情報", exact: true }).click();
  await page.getByRole("button", { name: "検索で絞り込む" }).click();
  await page.getByLabel("会社名", { exact: true }).fill("協力会社 B");
  await page.getByLabel("未提出", { exact: true }).check();
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await expect(page.locator(".gf-matrix tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "不足確認・提出・履歴" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "仮提出（デモ）" }),
  ).toBeDisabled();
  await dialog.getByLabel("建設業許可情報", { exact: true }).check();
  await dialog.getByLabel("運送事業許可情報", { exact: true }).check();
  await dialog.getByRole("button", { name: "仮提出（デモ）" }).click();
  await dialog.getByLabel("コメント・差戻し理由").fill("許可番号の訂正");
  await dialog.getByRole("button", { name: "差戻し（デモ）" }).click();
  await dialog.getByRole("button", { name: "再提出（デモ）" }).click();
  await dialog.getByRole("button", { name: "元請確認（デモ）" }).click();
  await expect(dialog).toContainText("受領済");
  await expect(dialog).toContainText("許可番号の訂正");
  await dialog.getByRole("button", { name: "書類確認を閉じる" }).click();
  await page.getByRole("button", { name: "検索条件をクリア" }).click();
  await expect(page.locator(".gf-matrix tbody tr")).toHaveCount(3);
  await page.reload();
  await page.getByRole("button", { name: "許可情報", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "協力会社 B" }),
  ).toContainText("受領済");
});

test("日次便枠・数量枠は別設定、取消と未配車を正しく集計", async ({ page }) => {
  await page.goto(`${receiving}&page=receiving-locations`);
  const section = page.locator(".daily-capacity");
  await section.getByLabel("当日受付の便数枠").fill("2");
  await section.getByLabel("当日受付の数量枠").fill("10");
  await section.getByRole("button", { name: "デモ内で保存（未送信）" }).click();
  await expect(section).toContainText("3便／1台");
  await expect(section).toContainText("0便／1便");
  await expect(section).toContainText("予約数量／残枠／超過");
  await section
    .getByRole("combobox", { name: "数量の単位", exact: true })
    .selectOption("t");
  await section.getByRole("button", { name: "デモ内で保存（未送信）" }).click();
  await expect(section).toContainText("8 t");
});

test("配車変更は3画面共通。過去便を変更せず、版変更で本人車両の再確認", async ({
  page,
  context,
}) => {
  await page.goto(`${construction}&page=dispatch`);
  await page
    .getByRole("row")
    .filter({ hasText: "TR-20260820-03" })
    .getByRole("button")
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("車両", { exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel("変更・取消理由").fill("検証用の代車");
  await dialog
    .getByRole("button", { name: "変更をデモ内に反映（未送信）" })
    .click();
  const receive = await context.newPage();
  await receive.goto(`${receiving}&page=receiving-reservations`);
  await receive
    .getByRole("button", { name: "TR-20260820-03の予約詳細", exact: true })
    .click();
  await expect(receive.locator(".receiving-detail")).toContainText(
    "成田 100 を 01-01",
  );
  const driver = await context.newPage();
  await driver.goto("/?app=driver");
  await driver
    .getByRole("button")
    .filter({ hasText: "TR-20260820-03" })
    .click();
  await expect(driver.locator(".driver-confirmation")).toContainText(
    "配車版 2",
  );
  await expect(driver.locator(".driver-confirmation")).toContainText(
    "成田 100 を 01-01",
  );
  await expect(
    driver.getByRole("button", { name: "受入先到着を報告", exact: true }),
  ).toBeDisabled();
  await page.goto(`${construction}&page=results`);
  await expect(
    page.getByRole("row").filter({ hasText: "TR-20260820-01" }),
  ).toContainText("6.8 m³");
});

for (const theme of ["light", "dark"])
  for (const width of [1440, 390])
    for (const route of [
      "transport",
      "dispatch",
      "results",
      "vehicles",
      "labor",
      "agency-request",
      "company",
    ])
      test(`construction ${route} ${theme} ${width}表示・操作`, async ({
        page,
      }) => {
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.addInitScript(
          (t) => localStorage.setItem("ecodump-theme", t),
          theme,
        );
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${construction}&page=${route}`);
        await expect(page.locator(".control-page-surface")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBeLessThanOrEqual(2);
        expect(errors).toEqual([]);
        if (width === 390 && route === "labor" && theme === "dark")
          await page.screenshot({ path: `${evidence}labor-mobile-dark.png` });
        if (width === 1440 && route === "transport" && theme === "light")
          await page.screenshot({
            path: `${evidence}construction-pc-light.png`,
          });
      });

test("ドライバー本人確認→到着→荷下ろし→伝票→受入確定が同じ便の実績へ反映", async ({
  page,
  context,
}) => {
  await page.goto("/?app=driver");
  await page
    .locator(".trip-card")
    .filter({ hasText: "TR-20260820-03" })
    .click();
  const arrive = page.getByRole("button", {
    name: "受入先到着を報告",
    exact: true,
  });
  await expect(arrive).toBeDisabled();
  await page.getByRole("button", { name: "この内容で運行する" }).click();
  await arrive.click();
  await page
    .getByRole("button", { name: "報告を下書き保存", exact: true })
    .click();
  await page
    .getByRole("button", { name: "荷下ろし完了を報告", exact: true })
    .click();
  await page
    .getByRole("button", { name: "報告を下書き保存", exact: true })
    .click();
  await expect(page.locator(".detail-status")).toContainText("荷下ろし完了");
  const receipt = page.locator(".demo-receipt");
  await receipt
    .getByLabel("原票写真（JPEG・PNG 2MB以下）")
    .setInputFiles(
      fileURLToPath(new URL("../../public/ecodump-logo.png", import.meta.url)),
    );
  await receipt.getByLabel("伝票番号", { exact: true }).fill("NARITA-DEMO-03");
  await receipt.getByLabel("原票の数量", { exact: true }).fill("6.9");
  await receipt.getByRole("button", { name: "提出前の内容を見る" }).click();
  await receipt
    .getByRole("button", { name: "確認待ちの表示例を端末に保存（送信しない）" })
    .click();
  await expect(receipt.getByRole("status")).toContainText("確認待ち");
  const receivingPage = await context.newPage();
  await receivingPage.goto(`${receiving}&page=receiving-reservations`);
  await receivingPage
    .getByRole("button", { name: "TR-20260820-03の予約詳細" })
    .click();
  await expect(receivingPage.locator(".receiving-state-grid")).toContainText(
    "未確定",
  );
  await receivingPage.getByLabel("実績数量（m³）", { exact: true }).fill("6.8");
  await receivingPage.getByLabel("判断・変更・差異の理由").fill("デモ計量差");
  await receivingPage
    .getByRole("button", { name: "受入内容を確認（試作）" })
    .click();
  await receivingPage.getByRole("button", { name: "実績確定の確認へ" }).click();
  await receivingPage
    .getByRole("button", { name: "この内容で実績確定を試す" })
    .click();
  const constructionPage = await context.newPage();
  await constructionPage.goto(`${construction}&page=results`);
  const row = constructionPage
    .getByRole("row")
    .filter({ hasText: "TR-20260820-03" });
  await expect(row).toContainText("6.9 m³");
  await expect(row).toContainText("6.8 m³");
  await expect(row).toContainText("NARITA-DEMO-03");
  await expect(receipt).toContainText("6.8 m³（デモ）");
});

for (const theme of ["light", "dark"])
  for (const width of [1440, 390])
    test(`driver 今日・履歴・マイページ ${theme} ${width}`, async ({
      page,
    }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(
        (t) => localStorage.setItem("ecodump-driver-theme", t),
        theme,
      );
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/?app=driver");
      await expect(
        page.locator(".trip-card").filter({ hasText: "TR-20260820-03" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(2);
      await page
        .locator(".trip-card")
        .filter({ hasText: "TR-20260820-03" })
        .click();
      await expect(page.locator(".driver-confirmation")).toContainText(
        "青木 太郎",
      );
      await expect(page.locator(".driver-confirmation")).toContainText(
        "成田 100 を 01-03",
      );
      if (width === 390)
        await page.screenshot({
          path: `${evidence}driver-mobile-${theme}.png`,
        });
      await page
        .getByRole("button", { name: "今日の運行へ戻る", exact: true })
        .click();
      for (const name of ["運行履歴", "マイページ", "今日の運行"]) {
        await page
          .locator(".driver-bottom")
          .getByRole("button", { name, exact: true })
          .click();
        await expect(page.locator(".driver-content h1")).toBeVisible();
      }
      expect(errors).toEqual([]);
    });

test("会社情報の固定領域と4タブ・編集中の値を維持", async ({ page }) => {
  await page.goto(`${construction}&page=company`);
  await page.getByRole("tab", { name: "労務安全項目", exact: true }).click();
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page
    .getByLabel("代表者情報 代表者名", { exact: true })
    .fill("検証担当");
  const tabs = page.locator(".company-tabs");
  const before = await tabs.boundingBox();
  await page
    .locator(".company-details-scroll")
    .evaluate((e) => (e.scrollTop = 500));
  const after = await tabs.boundingBox();
  expect(Math.abs(before.y - after.y)).toBeLessThan(1);
  await expect(
    page.getByRole("button", { name: "保存", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "本社情報", exact: true }).click();
  await page.getByRole("tab", { name: "労務安全項目", exact: true }).click();
  await expect(
    page.getByLabel("代表者情報 代表者名", { exact: true }),
  ).toHaveValue("検証担当");
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByRole("tab")).toHaveCount(4);
});

for (const theme of ["light", "dark"])
  for (const route of [
    "transport",
    "receiving-reservations",
    "receiving-locations",
    "receiving-results",
  ])
    test(`receiving ${route} ${theme} 390表示`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(
        (t) => localStorage.setItem("ecodump-theme", t),
        theme,
      );
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(`${receiving}&page=${route}`);
      await expect(page.locator(".receiving-workspace")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
      if (route === "transport")
        await page.screenshot({
          path: `${evidence}receiving-mobile-${theme}.png`,
        });
    });

test("運行ダッシュボードは対象日を継承し空の便を代用しない", async ({
  page,
}) => {
  await page.goto(`${construction}&page=transport`);
  await page.getByRole("button", { name: "翌日", exact: true }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "運行ダッシュボード", exact: true })
    .click();
  await expect(page.getByLabel("運行ダッシュボードの対象日")).not.toHaveValue(
    demoDay(),
  );
  await expect(page.locator(".timeline-list")).toContainText("TR-20260821-01");
  await expect(page.locator(".timeline-list")).not.toContainText(
    "TR-20260820-02",
  );
  await page.getByLabel("運行ダッシュボードの対象日").fill("2050-01-01");
  await expect(page.locator(".timeline-list")).toContainText(
    "条件に一致する運行はありません",
  );
  await expect(
    page.getByRole("button", { name: "詳細", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".timeline-panel header")).toContainText("0便");
});
