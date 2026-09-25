import { test, expect } from "@playwright/test";
const entry = "/?preview=app&role=receiving";
const nav = (page, name) =>
  page.locator(".sidebar").getByRole("button", { name, exact: true });
for (const viewport of [
  { name: "PC", width: 1440, height: 1000 },
  { name: "tablet", width: 1024, height: 900 },
  { name: "tablet-portrait", width: 768, height: 1024 },
]) {
  test(`${viewport.name}: 承認から受付・実績確定、再読込で試作リセット`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize(viewport);
    await page.goto(entry);
    await expect(
      page.getByRole("button", { name: "受入場所別", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(nav(page, "労務安全")).toHaveCount(0);
    await expect(nav(page, "調整会議")).toHaveCount(0);
    await page.getByRole("button", { name: "T-001の予約詳細" }).click();
    await page
      .getByRole("button", { name: "予約を承認（試作）", exact: true })
      .click();
    await page
      .getByRole("button", { name: "到着受付（試作）", exact: true })
      .click();
    await page
      .getByRole("button", { name: "受入開始（試作）", exact: true })
      .click();
    await page
      .getByRole("button", { name: "荷下ろし完了のサンプル報告を反映" })
      .click();
    await expect(page.locator(".receiving-state-grid")).toContainText(
      "運行完了",
    );
    await expect(page.locator(".receiving-state-grid")).toContainText("未確定");
    await page.getByLabel("実績数量（m³）", { exact: true }).fill("7.5");
    await page.getByRole("button", { name: "受入内容を確認（試作）" }).click();
    await expect(page.getByRole("alert")).toContainText("差異理由");
    await page.getByLabel("判断・変更・差異の理由").fill("現地実測による差");
    await page.getByRole("button", { name: "受入内容を確認（試作）" }).click();
    await page.getByRole("button", { name: "実績確定の確認へ" }).click();
    await page
      .getByRole("button", { name: "この内容で実績確定を試す" })
      .click();
    await expect(
      page.getByRole("heading", { name: "実績確定（試作）" }),
    ).toBeVisible();
    await nav(page, "実績・帳票").click();
    await expect(
      page.getByRole("row").filter({ hasText: "T-001" }),
    ).toContainText("7.5 m³");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "試作CSVを出力" }).click();
    expect((await download).suggestedFilename()).toContain("試作");
    await nav(page, "受入管理").click();
    await expect(
      page.locator(".receiving-kpis article").filter({ hasText: "完了" }),
    ).toContainText("2");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      ),
    ).toBe(false);
    await page.reload();
    await page.getByRole("button", { name: "T-001の予約詳細" }).click();
    await expect(
      page.getByRole("button", { name: "予約を承認（試作）" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test("公開範囲のプレビューと場所編集を反映", async ({ page }) => {
  await page.goto(entry);
  await nav(page, "受入場所管理").click();
  await page.getByLabel("情報の見え方を確認").selectOption("公開閲覧者");
  await expect(
    page.getByText("東側入口・受付で便IDを提示", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("管理する受入場所").selectOption("Y-02");
  await expect(
    page.getByText("この場所は公開されません。取引先にだけ表示する設定です。"),
  ).toBeVisible();
  await page.getByLabel("情報の見え方を確認").selectOption("管理者");
  await page.getByRole("button", { name: "場所・条件を編集" }).click();
  await page
    .getByLabel("場所名", { exact: true })
    .fill("サンプル受入ヤード B 更新");
  await page.getByRole("button", { name: "試作に反映（保存なし）" }).click();
  await nav(page, "受入管理").click();
  await expect(
    page.getByRole("heading", { name: "サンプル受入ヤード B 更新" }),
  ).toBeVisible();
});
test("従来サンプルの搬出候補から申請、直接予約も申請止まり", async ({ page }) => {
  await page.goto(entry);
  await nav(page, "発生土マッチ").click();
  await expect(
    page.getByRole("button", { name: "現場から探す", exact: true }),
  ).toHaveClass(/active/);
  await expect(page.locator(".match-detail h3")).toHaveText(
    "サンプル搬出現場 A",
  );
  await page
    .getByRole("button", { name: "この搬出案件から予約下書きへ" })
    .click();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "申請を試作に追加（未送信）" })
    .click();
  await expect(page.locator(".receiving-state-grid")).toContainText("申請中");
  await expect(
    page.getByRole("button", { name: "到着受付（試作）" }),
  ).toHaveCount(0);
  await nav(page, "取引先・基本設定").click();
  await page
    .getByRole("button", { name: "直接予約を試す", exact: true })
    .first()
    .click();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "申請を試作に追加（未送信）" })
    .click();
  await expect(page.locator(".receiving-detail")).toContainText("直接予約");
});
test("変更依頼・再申請・受入不可・取消と検索", async ({ page }) => {
  await page.goto(entry);
  await page.getByRole("button", { name: "T-001の予約詳細" }).click();
  await page.getByRole("button", { name: "変更依頼（試作）" }).click();
  await expect(page.getByRole("alert")).toContainText("理由");
  await page.getByLabel("判断・変更・差異の理由").fill("時間変更");
  await page.getByRole("button", { name: "変更依頼（試作）" }).click();
  await page.getByLabel("到着予定の変更").fill("14:00");
  await page.getByRole("button", { name: "変更内容で再申請を試す" }).click();
  await page.getByRole("button", { name: "受入不可（理由必須）" }).click();
  await expect(page.locator(".receiving-state-grid")).toContainText("受入不可");
  await nav(page, "受入管理").click();
  await expect(
    page.getByRole("button", { name: "T-001の予約詳細" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "T-002の予約詳細" }).click();
  await page.getByLabel("判断・変更・差異の理由").fill("工事中止");
  await page.getByRole("button", { name: "予約取消（理由必須）" }).click();
  await expect(page.locator(".receiving-state-grid")).toContainText("取消");
});
for (const theme of ["light", "dark"])
  test(`PC・タブレット全6画面表示 ${theme}`, async ({ page }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("ecodump-theme", theme),
      theme,
    );
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1024, height: 900 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(entry);
      for (const name of [
        "受入管理",
        "受入場所管理",
        "搬入予約・受付",
        "発生土マッチ",
        "実績・帳票",
        "取引先・基本設定",
      ]) {
        if (name === "発生土マッチ" && !await page.locator(".sidebar-suite-nav").isVisible()) {
          await page.locator(".sidebar .collapse").click();
        }
        await nav(page, name).click();
        await expect(page.locator(".content h1")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBeLessThanOrEqual(2);
        await expect(
          page.getByText(name === "発生土マッチ" ? "操作プレビュー：変更は保存・送信されません。適合度・距離・件数はサンプルです。" : "受入側の操作試作 · API未接続"),
        ).toBeVisible();
      }
    }
  });

test("ホーム絞込・翌日・役割別URLで受入と施工の文脈を保持", async ({ page }) => {
  await page.goto(entry);
  await page.getByLabel("現場・受入場所・車両を検索").fill("T-002");
  await expect(
    page.getByRole("button", { name: "T-002の予約詳細" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "T-001の予約詳細" }),
  ).toHaveCount(0);
  await page.getByLabel("現場・受入場所・車両を検索").fill("");
  await page.getByRole("button", { name: /翌日 20/ }).click();
  await expect(
    page.getByRole("button", { name: "T-007の予約詳細" }),
  ).toBeVisible();
  await expect(page.getByLabel("事業モード", { exact: true })).toHaveCount(0);
  await page.goto("/?preview=app&role=construction&page=transport");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "搬出管理", exact: true }),
  ).toBeVisible();
  await page.goto(entry);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "受入場所別", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByLabel("事業モード", { exact: true })).toHaveCount(0);
});
