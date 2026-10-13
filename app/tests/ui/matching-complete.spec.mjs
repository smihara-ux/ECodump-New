import { test, expect } from "@playwright/test";
import { dayOffset } from "../../src/demo/model.mjs";
const start = "/?preview=app&role=construction&page=matching&demo=1&navigationReview=1";
async function confirmTerms(page, actor) {
  await page.getByRole("button", { name: "サンプル資料を開く", exact: true }).click();
  await page.getByLabel("この版のサンプル資料を確認しました", { exact: true }).check();
  await page.getByRole("button", { name: "資料の確認を記録（デモ）", exact: true }).click();
  await page.getByLabel(/版の条件を確認し、合意します/).check();
  await page.getByRole("button", { name: `${actor}として条件に合意（デモ）`, exact: true }).click();
}
async function expectReservationTextFits(page) {
  const cells = page.locator(".journey-reservations-table tbody td");
  await expect(cells.first()).toBeVisible();
  const overflowing = await cells.evaluateAll(elements => elements.filter(element => {
    const box = element.getBoundingClientRect(), range = document.createRange();
    range.selectNodeContents(element);
    return [...range.getClientRects()].some(rect => rect.width > 0 && (rect.left < box.left - 1 || rect.right > box.right + 1 || rect.bottom > box.bottom + 1));
  }).map(element => element.textContent));
  expect(overflowing).toEqual([]);
  if (page.viewportSize().width <= 760) {
    const row = page.locator(".journey-reservations-table tbody tr").first();
    const box = await row.boundingBox(), id = await row.locator("td").nth(0).boundingBox();
    expect(id.width).toBeGreaterThanOrEqual(box.width - 32);
    expect((await row.locator("td").nth(1).boundingBox()).width).toBeGreaterThan(100);
  }
}
async function registerAndAgree(page) {
  await page.goto(start);
  await page.getByRole("button", { name: "新しい案件を登録", exact: true }).click();
  const form = page.getByRole("dialog", { name: "搬出案件登録", exact: true });
  await expect(form.getByRole("combobox", { name: "搬出現場", exact: true }).locator("option")).toHaveCount(23);
  await form.getByLabel("総数量（m³）", { exact: true }).fill("6400");
  await form.getByRole("button", { name: "搬出案件を登録して候補へ（デモ）", exact: true }).click();
  await expect(form).toHaveCount(0);
  await page.getByRole("button", { name: "事前相談を開始（デモ）", exact: true }).click();
  await confirmTerms(page, "施工側");
  await expect(page.getByRole("heading", { name: "マッチング成立（デモ）", exact: true })).toHaveCount(0);
  await page.locator(".journey-role-bar").getByRole("button", { name: "受入側の確認画面へ（デモ）", exact: true }).click();
  await confirmTerms(page, "受入側");
  await expect(page.getByRole("heading", { name: "マッチング成立（デモ）", exact: true })).toBeVisible();
  await page.locator(".journey-role-bar").getByRole("button", { name: "施工側の確認画面へ（デモ）", exact: true }).click();
}
async function createPlans(page) {
  await page.getByRole("button", { name: "合意済み案件から予定を作る", exact: true }).click();
  const form = page.getByRole("form", { name: "合意済み案件の予定作成", exact: true });
  await expect(form).toContainText("第2種建設発生土");
  await expect(form).toContainText("MDEMO-AGREEMENT-001");
  await page.getByRole("button", { name: "予定を作成して予約申請（デモ）", exact: true }).click();
  return page.evaluate(() => JSON.parse(localStorage.getItem("ecodump-narita-preview-v1")).trips.filter(trip => trip.matchAgreementId));
}

for (const theme of ["light", "dark"]) for (const width of [390, 1440]) {
  test(`registration to same-case agreement, two trips, receiving approval and dispatch ${theme} ${width}`, async ({ page }) => {
    const errors = [], writes = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() !== "GET" || /\/api\/|supabase\.co/.test(request.url())) writes.push(request.url()); });
    await page.addInitScript(theme => localStorage.setItem("ecodump-theme", theme), theme);
    await page.setViewportSize({ width, height: 1000 });
    await registerAndAgree(page);
    const rows = await createPlans(page);
    expect(rows).toHaveLength(2); expect(rows[0].reservationId).toBe(rows[1].reservationId);
    for (const row of rows) { expect(row.material).toBe("第2種建設発生土"); expect(row.reservation).toBe("申請中"); expect(row.vehicleId).toBe(""); }
    await page.locator("tbody tr").filter({ hasText: rows[0].id }).getByRole("button", { name: "詳細・操作", exact: true }).click();
    await page.getByRole("tab", { name: "割当", exact: true }).click();
    await expect(page.getByRole("button", { name: "変更をデモ内に反映（未送信）", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "受入側でこの予約を確認", exact: true }).click();
    for (const row of rows) {
      if (row.id !== rows[0].id) await page.goto(`/?preview=app&role=receiving&page=receiving-reservations&demo=1&matchTrip=${row.id}`);
      await expect(page.locator(".receiving-detail")).toContainText(row.id);
      await expect(page.locator(".receiving-detail")).toContainText(row.matchAgreementId);
      await expect(page.locator(".receiving-detail")).toContainText("第2種建設発生土");
      await page.getByRole("button", { name: "予約を承認（試作）", exact: true }).click();
      await expect(page.locator(".receiving-detail")).toContainText("予約確定");
    }
    await page.getByRole("button", { name: "この案件の成立内容へ戻る", exact: true }).click();
    await expect(page.locator(".journey-after")).toContainText("承認済み 2便");
    await expectReservationTextFits(page);
    await page.locator(".journey-role-bar").getByRole("button", { name: "施工側の確認画面へ（デモ）", exact: true }).click();
    await page.getByRole("button", { name: "合意済み案件から予定を作る", exact: true }).click();
    await page.locator("tbody tr").filter({ hasText: rows[0].id }).getByRole("button", { name: "詳細・操作", exact: true }).click();
    await page.getByRole("tab", { name: "割当", exact: true }).click();
    await page.getByRole("dialog").getByLabel("車両", { exact: true }).selectOption("31000000-0000-4000-8000-000000000001");
    await page.getByRole("dialog").getByLabel("ドライバー", { exact: true }).selectOption("41000000-0000-4000-8000-000000000001");
    await page.getByLabel("変更・取消理由", { exact: true }).fill("受入承認後の初回配車");
    await page.getByRole("button", { name: "変更をデモ内に反映（未送信）", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("ecodump-narita-preview-v1")).trips.filter(trip => trip.matchAgreementId));
    expect(saved.every(trip => trip.reservation === "予約確定")).toBe(true);
    expect(saved.find(trip => trip.id === rows[0].id).vehicleId).toBe("31000000-0000-4000-8000-000000000001");
    expect(saved.every(trip => trip.sourceCaseId === rows[0].sourceCaseId && trip.targetCaseId === rows[0].targetCaseId)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]); expect(writes).toEqual([]);
  });
}

test("receiving registration has distinct fields and updates the same receiving case", async ({ page }) => {
  await page.goto("/?preview=app&role=receiving&page=matching&demo=1");
  await page.getByRole("button", { name: "新しい案件を登録", exact: true }).click();
  const form = page.getByRole("dialog", { name: "受入条件登録", exact: true });
  await expect(form.getByLabel("受入場所", { exact: true })).toBeVisible();
  await expect(form.getByLabel("搬出現場", { exact: true })).toHaveCount(0);
  await form.getByLabel("この受入案件の総数量上限", { exact: true }).fill("7000");
  await form.getByRole("button", { name: "受入条件を登録（デモ）", exact: true }).click();
  await page.locator(".journey-role-bar").getByRole("button", { name: "施工側の確認画面へ（デモ）", exact: true }).click();
  await page.getByRole("button", { name: "この搬出条件で候補を確認（デモ）", exact: true }).click();
  await expect(page.locator(".journey-checks")).toContainText("7,000 m³");
});

test("requested changes are resubmitted by construction and need receiving approval again", async ({ page }) => {
  await registerAndAgree(page); const rows = await createPlans(page);
  await page.goto(`/?preview=app&role=receiving&page=receiving-reservations&demo=1&matchTrip=${rows[0].id}`);
  await page.getByLabel("判断・変更・差異の理由", { exact: true }).fill("到着予定を調整してください");
  await page.getByRole("button", { name: "変更依頼（試作）", exact: true }).click();
  await expect(page.getByRole("button", { name: "変更内容で再申請を試す", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "施工側で予定・配車を確認", exact: true }).click();
  const form = page.getByRole("form", { name: "予約の修正・再申請", exact: true });
  await form.getByLabel("再申請の受入指定時刻", { exact: true }).fill("10:30");
  await form.getByLabel("修正理由", { exact: true }).fill("受入側の指定時刻に変更");
  await form.getByRole("button", { name: "修正して予約を再申請（デモ）", exact: true }).click();
  await page.goto(`/?preview=app&role=receiving&page=receiving-reservations&demo=1&matchTrip=${rows[0].id}`);
  await expect(page.locator(".receiving-detail")).toContainText("10:30");
  await page.getByRole("button", { name: "予約を承認（試作）", exact: true }).click();
  await expect(page.locator(".receiving-detail")).toContainText("予約確定");
});

test("TOP opens the right view and creation form, while preserving site/date and contextual slip filtering", async ({ page }) => {
  await page.goto("/?preview=app&role=construction&page=transport&demo=1&navigationReview=1");
  await expect(page.getByRole("heading", { name: "労務安全・現場参加の確認", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "予定を作る", exact: true }).click();
  await expect(page.locator(".daily-plan-form")).toBeVisible();
  await page.getByRole("button", { name: "搬出管理へ戻る", exact: true }).click();
  await page.getByRole("button", { name: "今日の運行を見る", exact: true }).click();
  await expect(page.locator(".review-operations")).toBeVisible();
  await page.goto("/?preview=app&role=construction&page=transport&demo=1&navigationReview=1");
  await page.getByRole("button", { name: "伝票を確認する", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "伝票", exact: true })).toHaveValue("未確認");
});

test("source-site vertical chart shows scoped same-unit trips and maintains the existing state chart", async ({ page }) => {
  await page.goto("/?preview=app&role=receiving&page=receiving-locations&demo=1");
  await page.getByRole("button", { name: "搬出元現場別", exact: true }).click();
  const chart = page.getByRole("region", { name: "搬出元現場別の数量グラフ", exact: true });
  await expect(chart).toContainText("成田空港モデル現場 A工区");
  await expect(chart.locator(".cap-a-bars > button")).toHaveCount(12);
  await page.getByRole("combobox", { name: "現場別グラフの数量区分", exact: true }).selectOption("受入確定量");
  await expect(chart.locator(".cap-a-legend")).toContainText("6.8 m³");
  const column = chart.locator(".cap-a-columns > button").filter({ has: page.locator(".cap-a-stack i") }).first();
  const area = await column.locator(".cap-a-bar-area").boundingBox();
  const stack = await column.locator(".cap-a-stack").boundingBox();
  expect(stack.height).toBeGreaterThan(0);
  expect(stack.x).toBeGreaterThanOrEqual(area.x);
  expect(stack.x + stack.width).toBeLessThanOrEqual(area.x + area.width + 1);
  expect(stack.y + stack.height).toBeLessThanOrEqual(area.y + area.height + 1);
  await column.click();
  expect(await chart.locator(".cap-a-table tr").first().evaluate(element => getComputedStyle(element).display)).toBe("table-row");
  await page.getByRole("button", { name: "状態別", exact: true }).click();
  await expect(page.getByRole("region", { name: "受入枠グラフ。横スクロールで期間全体を確認", exact: true })).toBeVisible();
});

test("direct planning keeps the selected existing site outside Narita A and B", async ({ page }) => {
  await page.goto("/?preview=app&role=construction&page=transport&demo=1&navigationReview=1");
  await page.getByRole("combobox", { name: "現場", exact: true }).selectOption("サンプル現場 C");
  await page.getByRole("button", { name: "予定を作る", exact: true }).click();
  const form = page.locator(".daily-plan-form");
  await expect(form.getByRole("combobox", { name: "搬出元", exact: true }).locator("option")).toHaveText(["サンプル現場 C"]);
  await form.getByRole("button", { name: "デモ内に予定を追加（未送信）", exact: true }).click();
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem("ecodump-narita-preview-v1")).trips.filter(trip => trip.departure === "サンプル現場 C"));
  expect(rows).toHaveLength(1);
  expect(rows[0].departure).toBe("サンプル現場 C");
  expect(rows[0].reservation).toBe("申請中");
});

for (const width of [390, 1440]) test(`a previous reservation opens its own fixed agreement after the current demo is restarted ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await registerAndAgree(page); const rows = await createPlans(page);
  await page.goto(start + "&matchingDemo=1");
  await page.getByRole("button", { name: "デモを最初からやり直す", exact: true }).click();
  await page.getByRole("button", { name: "最初からやり直す", exact: true }).click();
  await expect(page.locator(".journey-source")).toContainText("第2種建設発生土");
  const currentId = await page.evaluate(() => JSON.parse(localStorage.getItem("ecodump-matching-journey-v1")).sourceCaseId);
  expect(currentId).not.toBe(rows[0].sourceCaseId);
  await page.goto(`/?preview=app&role=receiving&page=receiving-reservations&demo=1&matchTrip=${rows[0].id}`);
  await page.getByRole("button", { name: "この案件の成立内容へ戻る", exact: true }).click();
  await expect(page.locator(".journey-agreed")).toContainText(rows[0].matchAgreementId);
  await expectReservationTextFits(page);
  await expect(page.locator(".journey-agreed")).toContainText(rows[0].sourceCaseId);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ecodump-matching-journey-v1")).sourceCaseId)).toBe(currentId);
  await page.getByRole("button", { name: "相手側で成立内容を確認", exact: true }).click();
  await expect(page.locator(".journey-agreed")).toContainText(rows[0].matchAgreementId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath("previous-agreement.png") });
});

test("copying matching reservations enforces the agreement and creates one new pending reservation without assignments", async ({ page }) => {
  await registerAndAgree(page); const rows = await createPlans(page);
  await page.getByRole("button", { name: "前日・前週からコピー", exact: true }).click();
  await page.getByLabel("コピー元日", { exact: true }).fill(rows[0].date);
  await page.getByLabel("保存対象日", { exact: true }).fill(dayOffset(rows[0].agreementSnapshot.terms.end, 1));
  await page.getByLabel("対象日・便・受入先を確認しました", { exact: true }).check();
  await page.getByRole("button", { name: "確認して下書きへ反映", exact: true }).click();
  await expect(page.locator(".dispatch-page [role=alert]")).toContainText("合意した期間内");
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("ecodump-narita-preview-v1")).trips);
  expect(before.some(trip => trip.copiedFromDate)).toBe(false);
  await page.getByLabel("保存対象日", { exact: true }).fill(dayOffset(rows[0].date, 1));
  await page.getByLabel("対象日・便・受入先を確認しました", { exact: true }).check();
  await page.getByRole("button", { name: "確認して下書きへ反映", exact: true }).click();
  const copied = await page.evaluate(() => JSON.parse(localStorage.getItem("ecodump-narita-preview-v1")).trips.filter(trip => trip.matchAgreementId && trip.copiedFromDate));
  expect(copied).toHaveLength(2);
  expect(copied[0].reservationId).toBe(copied[1].reservationId);
  expect(copied[0].reservationId).not.toBe(rows[0].reservationId);
  expect(copied.every(trip => trip.reservation === "申請中" && !trip.vehicleId && !trip.driverId && trip.operation === "未手配")).toBe(true);
});

test("cancelled assigned matching trips are excluded from current assignment and approval counts", async ({ page }) => {
  await registerAndAgree(page); const rows = await createPlans(page);
  await page.goto(`/?preview=app&role=receiving&page=receiving-reservations&demo=1&matchTrip=${rows[0].id}`);
  await page.getByRole("button", { name: "予約を承認（試作）", exact: true }).click();
  await page.getByRole("button", { name: "施工側で予定・配車を確認", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await page.getByRole("tab", { name: "割当", exact: true }).click();
  await dialog.getByLabel("車両", { exact: true }).selectOption("31000000-0000-4000-8000-000000000001");
  await dialog.getByLabel("ドライバー", { exact: true }).selectOption("41000000-0000-4000-8000-000000000001");
  await dialog.getByLabel("変更・取消理由", { exact: true }).fill("承認後の割当");
  await page.getByRole("button", { name: "変更をデモ内に反映（未送信）", exact: true }).click();
  await page.locator("tbody tr").filter({ hasText: rows[0].id }).getByRole("button", { name: "詳細・操作", exact: true }).click();
  await page.getByRole("tab", { name: "取消", exact: true }).click();
  await dialog.getByLabel("変更・取消理由", { exact: true }).fill("テスト対象便を取消");
  await dialog.getByRole("button", { name: "取消をデモ内に反映", exact: true }).click();
  await dialog.getByRole("button", { name: "この便の取消を確定する（デモ）", exact: true }).click();
  await page.goto(start + "&matchingDemo=1");
  await expect(page.locator(".journey-after")).toContainText("取消 1便");
  await expect(page.locator(".journey-after")).toContainText("承認済み 0便 / 申請中 1便");
  await expect(page.locator(".journey-after")).not.toContainText("手配済み 1便");
});
