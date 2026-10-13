import { expect, test } from "@playwright/test";

const start = "/?preview=app&role=construction&page=matching&demo=1&navigationReview=1&matchingDemo=1";
const demo = page => page.getByRole("region", { name: "マッチング成立デモ", exact: true });
async function begin(page) {
  await page.goto(start);
  await page.getByRole("button", { name: "この搬出条件で候補を確認（デモ）", exact: true }).click();
  await page.getByRole("button", { name: "事前相談を開始（デモ）", exact: true }).click();
}
async function review(page) {
  await page.getByRole("button", { name: "サンプル資料を開く", exact: true }).click();
  await page.getByLabel("この版のサンプル資料を確認しました", { exact: true }).check();
  await page.getByRole("button", { name: "資料の確認を記録（デモ）", exact: true }).click();
  await page.getByLabel(/版の条件を確認し、合意します/).check();
}

test("login demo shortcut leads to the original shell and operable matching journey", async ({ page }) => {
  await page.goto("/?entry=1");
  await page.getByText("デモで試す", { exact: true }).click();
  await page.getByRole("button", { name: "マッチング成立の流れを試す →", exact: true }).click();
  await expect(demo(page)).toBeVisible();
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.getByRole("button", { name: "通常の候補画面へ", exact: true }).click();
  await expect(page.getByRole("button", { name: "新しい案件を登録", exact: true })).toBeVisible();
  await expect(demo(page)).toHaveCount(0);
  await page.getByRole("button", { name: "マッチング成立デモを試す", exact: true }).click();
  await expect(demo(page)).toBeVisible();
});

test("two roles agree to one case and reload preserves the agreement without reservations or network writes", async ({ page }) => {
  const errors = [], writes = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.method() !== "GET" || /\/api\/|supabase\.co/.test(request.url())) writes.push(request.url());
  });
  await begin(page);
  await expect(page.getByRole("button", { name: "施工側として条件に合意（デモ）", exact: true })).toBeDisabled();
  await review(page);
  await page.getByRole("button", { name: "施工側として条件に合意（デモ）", exact: true }).click();
  await expect(page.locator(".journey-feedback")).toContainText("相手側の確認待ち");
  await expect(page.getByRole("heading", { name: "マッチング成立（デモ）", exact: true })).toHaveCount(0);
  await page.locator(".journey-role-bar").getByRole("button", { name: "受入側の確認画面へ（デモ）", exact: true }).click();
  await expect(page).toHaveURL(/role=receiving/);
  await expect(page.getByText("いまの操作：受入側（デモ）", { exact: true })).toBeVisible();
  await expect(demo(page)).toContainText("MDEMO-EXPORT-001");
  await expect(demo(page)).toContainText("第2種建設発生土");
  await review(page);
  await page.getByRole("button", { name: "受入側として条件に合意（デモ）", exact: true }).click();
  await expect(page.getByRole("heading", { name: "マッチング成立（デモ）", exact: true })).toBeVisible();
  await expect(page.locator(".journey-after")).toContainText("未申請");
  await expect(page.locator(".journey-after")).toContainText("未承認");
  await expect(page.locator(".journey-after")).toContainText("未手配");
  await page.reload();
  await expect(page.getByRole("heading", { name: "マッチング成立（デモ）", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "成立内容を確認", exact: true }).click();
  const agreementPosition = await page.locator(".journey-agreed").boundingBox();
  expect(agreementPosition.y).toBeGreaterThanOrEqual(0);
  expect(agreementPosition.y + agreementPosition.height).toBeLessThanOrEqual(844);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("ecodump-matching-journey-v1")));
  expect(saved.agreement.sourceCaseId).toBe("MDEMO-EXPORT-001");
  expect(saved.agreement.targetCaseId).toBe("MDEMO-RECEIVE-001");
  expect(saved.agreement.terms.volume).toBe(6400);
  expect(saved.agreement.terms.soil).toBe("第2種建設発生土");
  expect(saved.agreement.reservationId).toBeUndefined();
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test("unsuitable candidates explain the mismatch and prevent consultation", async ({ page }) => {
  await page.goto(start);
  await page.getByRole("button", { name: "この搬出条件で候補を確認（デモ）", exact: true }).click();
  await page.getByRole("button", { name: "茨城モデル採石場〈架空〉の条件を確認", exact: true }).click();
  await expect(page.locator(".journey-checks")).toContainText("! 要確認 · 総数量");
  await expect(page.getByRole("button", { name: "事前相談を開始（デモ）", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "サンプル受入ヤード C〈架空〉の条件を確認", exact: true }).click();
  await expect(page.locator(".journey-checks")).toContainText("! 要確認 · 土質");
  await expect(page.getByRole("button", { name: "事前相談を開始（デモ）", exact: true })).toBeDisabled();
});

test("condition changes revoke earlier agreement and require both roles to review the new revision", async ({ page }) => {
  await begin(page);
  await review(page);
  await page.getByRole("button", { name: "施工側として条件に合意（デモ）", exact: true }).click();
  await page.locator(".journey-role-bar").getByRole("button", { name: "受入側の確認画面へ（デモ）", exact: true }).click();
  await page.getByRole("button", { name: "条件を調整", exact: true }).click();
  await page.getByLabel("総数量（m³）", { exact: true }).fill("6000");
  await page.getByRole("button", { name: "変更した条件を提示（デモ）", exact: true }).click();
  await expect(page.locator(".journey-confirmations")).toContainText("合意待ち");
  await expect(page.getByRole("heading", { name: "合意する条件 · 第2版", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "受入側として条件に合意（デモ）", exact: true })).toBeDisabled();
  await review(page);
  await page.getByRole("button", { name: "受入側として条件に合意（デモ）", exact: true }).click();
  await expect(page.getByRole("heading", { name: "マッチング成立（デモ）", exact: true })).toHaveCount(0);
  await page.locator(".journey-role-bar").getByRole("button", { name: "施工側の確認画面へ（デモ）", exact: true }).click();
  await review(page);
  await page.getByRole("button", { name: "施工側として条件に合意（デモ）", exact: true }).click();
  await expect(page.locator(".journey-agreed")).toContainText("第2版");
  await expect(page.locator(".journey-detail")).toContainText("6,000 m³");
});

test("editing a stale dialog cannot overwrite a second tab's new terms", async ({ page, context }) => {
  await begin(page);
  await page.getByRole("button", { name: "条件を調整", exact: true }).click();
  const second = await context.newPage();
  await second.goto(start.replace("role=construction", "role=receiving"));
  await second.getByRole("button", { name: "条件を調整", exact: true }).click();
  await second.getByLabel("総数量（m³）", { exact: true }).fill("5800");
  await second.getByRole("button", { name: "変更した条件を提示（デモ）", exact: true }).click();
  await page.getByLabel("総数量（m³）", { exact: true }).fill("6000");
  await page.getByRole("button", { name: "変更した条件を提示（デモ）", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("別の画面でデモが更新");
  await page.getByRole("button", { name: "変更せず戻る", exact: true }).click();
  await expect(page.locator(".journey-detail")).toContainText("5,800 m³");
});

test("reset needs explicit confirmation and preserves unrelated browser data", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ecodump-unrelated-review", "keep this data"));
  await begin(page);
  await page.getByRole("button", { name: "デモを最初からやり直す", exact: true }).click();
  await page.getByRole("button", { name: "やり直さず戻る", exact: true }).click();
  await expect(page.getByRole("button", { name: "条件を調整", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "デモを最初からやり直す", exact: true }).click();
  await page.getByRole("button", { name: "最初からやり直す", exact: true }).click();
  await expect(page.getByRole("button", { name: "この搬出条件で候補を確認（デモ）", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ecodump-unrelated-review"))).toBe("keep this data");
});

test("failed browser storage never reports a published case or successful agreement", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "ecodump-matching-journey-v1") throw new DOMException("Quota full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.goto(start);
  await page.getByRole("button", { name: "この搬出条件で候補を確認（デモ）", exact: true }).click();
  await expect(demo(page).getByRole("alert")).toContainText("操作は完了していません");
  await expect(page.getByRole("button", { name: "この搬出条件で候補を確認（デモ）", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "事前相談を開始（デモ）", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem("ecodump-matching-journey-v1"))).toBeNull();
});

test("corrupted demo state requires an explicit reset while keeping other data", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ecodump-matching-journey-v1", "invalid json");
    localStorage.setItem("ecodump-unrelated-review", "keep");
  });
  await page.goto(start);
  await expect(demo(page).getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "この搬出条件で候補を確認（デモ）", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "デモを最初からやり直す", exact: true }).click();
  await page.getByRole("button", { name: "最初からやり直す", exact: true }).click();
  await expect(page.getByRole("button", { name: "この搬出条件で候補を確認（デモ）", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem("ecodump-unrelated-review"))).toBe("keep");
});

for (const theme of ["light", "dark"]) for (const width of [390, 1024, 1440]) {
  test(`journey dialogs and candidate layout are readable in ${theme} at ${width}px`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(theme => localStorage.setItem("ecodump-theme", theme), theme);
    await page.setViewportSize({ width, height: 900 });
    await begin(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    const overlaps = await page.locator(".journey-candidate").evaluateAll(cards => cards.filter(card => {
      const score = card.querySelector(".match-score").getBoundingClientRect();
      const main = card.querySelector(".match-main").getBoundingClientRect();
      return score.right > main.left + 1;
    }).length);
    expect(overlaps).toBe(0);
    await page.getByRole("button", { name: "条件を調整", exact: true }).click();
    const bounds = await page.getByRole("dialog").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    await page.getByRole("dialog").press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
