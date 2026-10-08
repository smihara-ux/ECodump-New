import { test, expect } from "@playwright/test";
import XLSX from "xlsx";

const entry = "/?preview=app&role=construction&page=transport";

test("施工の対象日・進捗・詳細・実績条件を一つの流れで維持", async ({ page }) => {
  await page.goto(entry);
  const date = await page.getByLabel("搬出管理の対象日").inputValue();
  await expect(page.getByRole("button", { name: /有効な予定便 5便/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /取消便 1便/ })).toBeVisible();
  await expect(page.getByText("未完了の残予定").first()).toBeVisible();
  await page.getByRole("button", { name: "運行詳細" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("時系列・報告");
  await expect(dialog).toContainText("訂正履歴");
  await dialog.getByRole("button", { name: "一覧へ戻る" }).click();
  await page.getByRole("combobox", { name: "現場", exact: true }).selectOption({ index: 1 });
  const field = await page.getByRole("combobox", { name: "現場", exact: true }).inputValue();
  await page.getByRole("button", { name: "搬出実績を見る" }).click();
  await expect(page.getByLabel("開始日")).toHaveValue(date);
  await expect(page.getByLabel("終了日")).toHaveValue(date);
  await expect(page.getByRole("combobox", { name: "現場", exact: true })).toHaveValue(field);
  await page.getByRole("button", { name: "搬出管理へ戻る" }).click();
  await expect(page.getByLabel("搬出管理の対象日")).toHaveValue(date);
  await expect(page.getByRole("combobox", { name: "現場", exact: true })).toHaveValue(field);
});

test("Excel帳票は画面条件と同じ実体xlsxの2シート", async ({ page }) => {
  await page.goto(entry);
  await page.getByRole("button", { name: "搬出実績を見る" }).click();
  const displayed = Number((await page.locator(".construction-kpis article").first().innerText()).match(/\d+/)?.[0]);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel帳票" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = XLSX.readFile(await file.path());
  expect(workbook.SheetNames).toEqual(["集計", "便別明細"]);
  const detail = XLSX.utils.sheet_to_json(workbook.Sheets["便別明細"], { header: 1 });
  expect(detail.length - 1).toBe(displayed);
});

for (const theme of ["light", "dark"]) {
  test(`PCとモバイルで0件・取消・複数便を表示 ${theme}`, async ({ page }) => {
    await page.addInitScript((value)=>localStorage.setItem("ecodump-theme", value), theme);
    await page.goto(entry);
    await expect(page.locator(".trip-row").filter({ hasText: "運行詳細" })).toHaveCount(6);
    await page.getByRole("button", { name: /取消便/ }).click();
    await expect(page.locator(".trip-row").filter({ hasText: "運行詳細" })).toHaveCount(1);
    await page.getByLabel("搬出管理の対象日").fill("2026-01-01");
    await expect(page.getByText("対象便はありません")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "今日", exact: false }).click();
    const card = page.locator(".trip-row").filter({ hasText: "運行詳細" }).first();
    await expect(card).toBeVisible();
    expect(await card.evaluate((node)=>getComputedStyle(node).gridTemplateColumns)).not.toContain(" ");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  });
}


test("未搬出の状態と検索を実績へ引き継ぎ、空の日付で壊れない", async ({page})=>{
 await page.goto(entry);
 await page.getByRole("button",{name:/未搬出便 1便/}).click();
 await page.getByRole("textbox",{name:"検索",exact:true}).fill("TR-20260820-04");
 await page.getByRole("button",{name:"搬出実績を見る",exact:true}).click();
 await expect(page.getByRole("combobox",{name:"状態",exact:true})).toHaveValue("未搬出");
 await expect(page.getByRole("textbox",{name:"検索",exact:true})).toHaveValue("TR-20260820-04");
 await expect(page.locator(".construction-kpis article").first()).toContainText("1");
 await page.getByRole("button",{name:"搬出管理へ戻る",exact:true}).click();
 const date=await page.getByLabel("搬出管理の対象日").inputValue();
 await page.getByLabel("搬出管理の対象日").fill("");
 await expect(page.getByLabel("搬出管理の対象日")).toHaveValue(date);
 await page.getByRole("button",{name:"翌日",exact:true}).click();
 await expect(page.getByRole("heading",{name:"搬出管理",exact:true})).toBeVisible();
});
