import { test, expect } from "@playwright/test";
const receiving =
  "/?preview=app&role=receiving&demo=1&page=receiving-reservations";
for (const theme of ["light", "dark"])
  for (const width of [1440, 768, 390])
    test(`receiver guided detail, drafts and safe finalization ${theme} ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (t) => localStorage.setItem("ecodump-theme", t),
        theme,
      );
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(receiving + "&matchTrip=TR-20260820-05");
      await expect(
        page.getByRole("tab", { name: "伝票・数量", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(page.getByLabel("現在の状態と次の対応")).toContainText(
        "対応：受入側",
      );
      await page.getByLabel("実績数量（m³）", { exact: true }).fill("7.3");
      await page
        .getByRole("button", { name: "受入内容を確認（試作）" })
        .click();
      await expect(page.getByRole("alert")).toContainText("差異理由");
      await page.getByLabel("判断・変更・差異の理由").fill("原票と実測を照合");
      await page.getByRole("tab", { name: "予約条件", exact: true }).click();
      await expect(page.getByRole("tabpanel")).toContainText(
        "成田空港モデル現場 A工区",
      );
      await page.getByRole("tab", { name: "伝票・数量", exact: true }).click();
      await expect(
        page.getByLabel("実績数量（m³）", { exact: true }),
      ).toHaveValue("7.3");
      await page.reload();
      await expect(
        page.getByLabel("実績数量（m³）", { exact: true }),
      ).toHaveValue("7.3");
      await expect(page.getByLabel("判断・変更・差異の理由")).toHaveValue(
        "原票と実測を照合",
      );
      await page
        .getByRole("button", { name: "受入内容を確認（試作）" })
        .click();
      await page.getByLabel("実績数量（m³）", { exact: true }).fill("7.4");
      await expect(
        page.getByRole("button", { name: "実績確定の確認へ" }),
      ).toBeDisabled();
      await expect(
        page.getByText(
          "入力内容が変わっています。「受入内容を確認」で再確認してください。",
        ),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "受入内容を確認（試作）" })
        .click();
      await page.getByRole("button", { name: "実績確定の確認へ" }).click();
      await expect(
        page.getByRole("group", { name: "実績確定の確認" }),
      ).toContainText("7.4 m³");
      await page
        .getByRole("button", { name: "この内容で実績確定を試す" })
        .click();
      await expect(
        page.getByRole("heading", { name: "実績確定（試作）" }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "履歴", exact: true }).click();
      await expect(page.getByRole("tabpanel")).toContainText("実績確定");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
    });
test("receiver approval, reception and reasoned cancellation remain distinct", async ({
  page,
}) => {
  await page.goto(receiving + "&matchTrip=TR-20260820-04");
  await expect(
    page.getByRole("tab", { name: "予約条件", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "予約を承認（試作）" }).click();
  await expect(
    page.getByRole("tab", { name: "受付", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "到着受付（試作）" }).click();
  await page.getByRole("button", { name: "受入開始（試作）" }).click();
  await page
    .getByRole("button", { name: "荷下ろし完了のサンプル報告を反映" })
    .click();
  await expect(
    page.getByRole("tab", { name: "伝票・数量", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".receiving-state-grid")).toContainText("未確定");
  await page.goto(receiving + "&matchTrip=TR-20260820-02");
  await page
    .getByText("その他の操作（変更・取消など）", { exact: true })
    .click();
  await page.getByRole("button", { name: "予約取消（理由必須）" }).click();
  await expect(page.getByRole("alert")).toContainText("理由");
  await page
    .getByLabel("判断・変更・差異の理由")
    .fill("予定変更により運搬不要");
  await page.getByRole("button", { name: "予約取消（理由必須）" }).click();
  await expect(
    page.getByRole("group", { name: "予約終了の確認" }),
  ).toContainText("予定変更により運搬不要");
  await page.getByRole("button", { name: "終了せず戻る" }).click();
  await expect(page.locator(".receiving-state-grid")).toContainText("予約確定");
  await page.getByRole("button", { name: "予約取消（理由必須）" }).click();
  await page
    .getByRole("button", { name: "理由を確認して予約取消にする（試作）" })
    .click();
  await expect(
    page.getByRole("tab", { name: "履歴", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText(
    "予定変更により運搬不要",
  );
});
for (const theme of ["light", "dark"])
  for (const width of [1440, 768, 390])
    test(`driver receipt three steps, inline errors and retained photo ${theme} ${width}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (t) => localStorage.setItem("ecodump-driver-theme", t),
        theme,
      );
      await page.goto("/?app=driver&demo=1");
      await page
        .locator(".trip-card")
        .filter({ hasText: "TR-20260820-03" })
        .click();
      const receipt = page.locator(".demo-receipt");
      expect(
        (
          await receipt
            .getByRole("button", { name: "数量入力へ" })
            .boundingBox()
        ).height,
      ).toBeGreaterThanOrEqual(44);
      await receipt.getByRole("button", { name: "数量入力へ" }).click();
      await expect(receipt.getByRole("alert")).toContainText("写真");
      await receipt
        .getByLabel("原票写真（JPEG・PNG 2MB以下）", { exact: true })
        .setInputFiles({
          name: "ticket.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=",
            "base64",
          ),
        });
      await receipt.getByRole("button", { name: "数量入力へ" }).click();
      await expect(
        receipt.getByRole("heading", { name: "2. 原票の内容を入力" }),
      ).toBeVisible();
      await receipt.getByRole("button", { name: "提出前の内容を見る" }).click();
      await expect(
        receipt.getByText("伝票番号を入力してください。", { exact: true }),
      ).toBeVisible();
      await receipt
        .getByLabel("伝票番号", { exact: true })
        .fill("UX-RECEIPT-03");
      await receipt.getByLabel("原票の数量", { exact: true }).fill("6.9");
      await receipt.getByRole("button", { name: "提出前の内容を見る" }).click();
      await expect(
        receipt.getByRole("heading", { name: "3. 提出前確認（端末内デモ）" }),
      ).toBeVisible();
      await expect(
        receipt.getByText("UX-RECEIPT-03", { exact: true }),
      ).toBeVisible();
      await receipt
        .getByRole("button", { name: "写真を確認・変更する" })
        .click();
      await expect(
        receipt.getByRole("img", { name: "端末内の原票写真" }),
      ).toBeVisible();
      await expect(receipt.getByRole("status")).toContainText(
        "未送信・端末下書き",
      );
      await page.reload();
      await page
        .locator(".trip-card")
        .filter({ hasText: "TR-20260820-03" })
        .click();
      await expect(
        receipt.getByRole("img", { name: "端末内の原票写真" }),
      ).toBeVisible();
      await receipt.getByRole("button", { name: "数量入力へ" }).click();
      await expect(receipt.getByLabel("伝票番号", { exact: true })).toHaveValue(
        "UX-RECEIPT-03",
      );
      await expect(
        receipt.getByLabel("原票の数量", { exact: true }),
      ).toHaveValue("6.9");
      await receipt.getByRole("button", { name: "提出前の内容を見る" }).click();
      await receipt
        .getByRole("button", {
          name: "確認待ちの表示例を端末に保存（送信しない）",
        })
        .click();
      await expect(receipt.getByRole("status")).toContainText("確認待ち");
      const receiver = await context.newPage();
      await receiver.goto(receiving + "&matchTrip=TR-20260820-03");
      await receiver
        .getByRole("tab", { name: "伝票・数量", exact: true })
        .click();
      await receiver
        .getByText("原票写真を確認（同じブラウザ内のデモ）", { exact: true })
        .click();
      await expect(
        receiver.getByRole("img", {
          name: "ドライバーが端末に保存した原票写真",
        }),
      ).toBeVisible();
      await expect(receiver.locator(".receiving-state-grid")).toContainText(
        "未確定",
      );
      await expect(receiver.getByRole("tabpanel")).toContainText(
        "UX-RECEIPT-03",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(2);
    });
test("reservation action filters and no-result reset preserve the selected scope on return", async ({
  page,
}) => {
  await page.goto(receiving);
  await page.getByRole("button", { name: "承認待ち", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "TR-20260820-04の予約詳細" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "TR-20260820-02の予約詳細" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "数量確認待ち", exact: true }).click();
  await page.getByRole("button", { name: "TR-20260820-05の予約詳細" }).click();
  await page.getByRole("button", { name: "← 予約一覧へ", exact: true }).click();
  await expect(page.getByLabel("予約・受付状態")).toHaveValue("数量確認待ち");
  await page.getByLabel("予約を検索", { exact: true }).fill("存在しない予約");
  await expect(
    page.getByText(
      "現在の日付・状態・検索条件に一致する予約はありません。条件を変えるか、絞り込みを解除してください。",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "予約の絞り込みを解除" }).click();
  await expect(page.getByLabel("予約・受付状態")).toHaveValue("すべて");
  await expect(page.getByRole("button", { name: /の予約詳細$/ })).toHaveCount(
    7,
  );
});
test("driver save failure retains input and never displays a successful pending submission", async ({
  page,
}) => {
  await page.goto("/?app=driver&demo=1");
  await page
    .locator(".trip-card")
    .filter({ hasText: "TR-20260820-03" })
    .click();
  const receipt = page.locator(".demo-receipt");
  await receipt
    .getByLabel("原票写真（JPEG・PNG 2MB以下）", { exact: true })
    .setInputFiles({
      name: "ticket.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await receipt.getByRole("button", { name: "数量入力へ" }).click();
  await receipt.getByLabel("伝票番号", { exact: true }).fill("RETRY-03");
  await receipt.getByLabel("原票の数量", { exact: true }).fill("6.5");
  await receipt.getByRole("button", { name: "提出前の内容を見る" }).click();
  await expect(receipt.getByRole("status")).toContainText("未送信・端末下書き");
  await page.evaluate(() => {
    globalThis.originalDraftPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("試験用の容量不足", "QuotaExceededError");
    };
  });
  await receipt
    .getByRole("button", { name: "確認待ちの表示例を端末に保存（送信しない）" })
    .click();
  await expect(receipt.getByRole("alert")).toContainText("保存できません");
  await expect(receipt.getByRole("status")).toContainText("未送信・端末下書き");
  await expect(receipt).toContainText("RETRY-03");
  await expect(receipt).toContainText("6.5 m³");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = globalThis.originalDraftPut;
  });
  await receipt
    .getByRole("button", { name: "確認待ちの表示例を端末に保存（送信しない）" })
    .click();
  await expect(receipt.getByRole("status")).toContainText("確認待ち");
  await expect(
    receipt.getByText("端末内の確認履歴 1件", { exact: true }),
  ).toBeVisible();
});
test("receiver keyboard tabs keep the pending inputs", async ({ page }) => {
  await page.goto(receiving + "&matchTrip=TR-20260820-05");
  await page.getByLabel("実績数量（m³）", { exact: true }).fill("7.2");
  const tab = page.getByRole("tab", { name: "伝票・数量", exact: true });
  await tab.focus();
  await tab.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "履歴", exact: true }),
  ).toBeFocused();
  await page.getByRole("tab", { name: "履歴", exact: true }).press("Home");
  await expect(
    page.getByRole("tab", { name: "予約条件", exact: true }),
  ).toBeFocused();
  await page.getByRole("tab", { name: "伝票・数量", exact: true }).click();
  await expect(page.getByLabel("実績数量（m³）", { exact: true })).toHaveValue(
    "7.2",
  );
});
