import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import XLSX from "xlsx";
import { createNaritaDemo, demoDay, dayOffset } from "../../src/demo/model.mjs";

const entry = "/?preview=app&role=construction&demo=1&navigationReview=1";
const evidence = process.env.ECODUMP_VEHICLE_REVIEW_DIR || "../tmp/vehicle-count-review-2026-10-14/after";

async function expectMetrics(page) {
  const cards = page.locator(".vehicle-metrics");
  await expect(cards.locator(":scope > :is(button,article)")).toHaveCount(4);
  for (const [key, label, actual, extended] of [
    ["有効予定", "予定台数", 3, 5], ["受入完了", "受入完了台数", 1, 1],
    ["受入待ち", "受入待ち台数", 3, 4], ["取消", "取消台数", 1, 1],
  ]) {
    await expect(cards.locator(`[data-vehicle-state="${key}"]`)).toHaveAttribute("aria-label", new RegExp(`^${label} 実${actual}台 延べ${extended}台`));
  }
  await expect(cards.locator('[data-vehicle-state="有効予定"]')).toContainText("未配車 1件");
  const clipped = await cards.locator(":scope > :is(button,article)").evaluateAll(elements=>elements.filter(element=> {
    const box=element.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(element);
    return [...range.getClientRects()].some(rect=>rect.width>0&&(rect.left<box.left-1||rect.right>box.right+1||rect.bottom>box.bottom+1));
  }).map(element=>element.textContent));
  expect(clipped).toEqual([]);
  const positions=await cards.locator(":scope > :is(button,article)").evaluateAll(elements=>elements.map(element=>({row:element.getBoundingClientRect().top,label:element.firstElementChild.getBoundingClientRect().top})));
  for (const position of positions) expect(position.label-position.row).toBeCloseTo(positions[0].label-positions[0].row,0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
}

for (const theme of ["light", "dark"]) for (const width of [390,1440]) {
  test(`same actual/extended metrics across construction, dispatch and operations; unified documents ${theme} ${width}`,async({page})=> {
    test.setTimeout(60000);mkdirSync(evidence,{recursive:true});
    await page.setViewportSize({width,height:1000});
    await page.addInitScript(theme=>localStorage.setItem("ecodump-theme",theme),theme);
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    await page.goto(`${entry}&page=transport`);await expectMetrics(page);
    await page.screenshot({path:`${evidence}/transport-${theme}-${width}.png`});
    await page.getByRole("button",{name:"受入場所別",exact:true}).click();
    await page.getByRole("button",{name:/^受入完了台数/}).click();
    await expect(page.locator(".trip-row").filter({hasText:"運行詳細"})).toHaveCount(1);
    await page.getByRole("button",{name:/^受入待ち台数/}).click();
    await expect(page.locator(".trip-row").filter({hasText:"運行詳細"})).toHaveCount(4);
    await page.getByRole("button",{name:/^取消台数/}).click();
    await expect(page.locator(".trip-row").filter({hasText:"運行詳細"})).toHaveCount(1);
    await page.getByRole("button",{name:/^予定台数/}).click();
    await page.goto(`${entry}&page=dispatch`);await expectMetrics(page);
    await page.screenshot({path:`${evidence}/dispatch-${theme}-${width}.png`});
    await page.goto(`${entry}&page=control`);await expectMetrics(page);
    await page.getByRole("button",{name:/^受入完了台数/}).click();
    await expect(page.locator(".review-timeline > button")).toHaveCount(1);
    await page.getByRole("button",{name:/^受入待ち台数/}).click();
    await expect(page.locator(".review-timeline > button")).toHaveCount(4);
    await page.getByRole("button",{name:/^取消台数/}).click();
    await expect(page.locator(".review-timeline > button")).toHaveCount(1);
    await page.getByRole("button",{name:/^予定台数/}).click();
    await page.screenshot({path:`${evidence}/control-${theme}-${width}.png`});
    await page.goto(`${entry}&page=labor`);
    await expect(page.getByRole("button",{name:"元請帳票の確認",exact:true})).toHaveCount(0);
    await expect(page.locator(".navigation-review-mobile select option")).not.toContainText(["元請帳票の確認"]);
    await expect(page.locator('.review-document-company[data-company-id="NC-01"] .review-document-row')).toHaveCount(6);
    await expect(page.locator(".review-document-row")).toHaveCount(18);
    const row=page.locator('.review-document-company[data-company-id="NC-02"] .review-document-row').first();
    const id=await row.getAttribute("data-record-id");
    await row.getByRole("button",{name:"確認・提出・履歴",exact:true}).click();
    await page.getByRole("button",{name:"元請確認（デモ）",exact:true}).click();
    await expect(page.getByRole("dialog")).toContainText("元請確認（デモ）");
    await page.getByRole("button",{name:"書類確認を閉じる",exact:true}).click();
    await page.reload();
    const retained=page.locator(`[data-record-id="${id}"]`);
    await expect(retained).toContainText("受領済");await expect(retained).toContainText("第2版");await expect(retained).toContainText("履歴1件");
    await page.screenshot({path:`${evidence}/labor-${theme}-${width}.png`});
    expect(errors).toEqual([]);
  });
}

test("period totals include both endpoints, exclude other days and match the filtered XLSX",async({page})=> {
  const today=demoDay(),yesterday=dayOffset(today,-1),tomorrow=dayOffset(today,1);
  const trips=createNaritaDemo(today),previous={...trips[0],id:"PERIOD-PREVIOUS",date:yesterday,planned:5,reported:4.3,confirmed:4};
  trips.push(previous,{...previous,id:"OUTSIDE-BEFORE",date:dayOffset(today,-2),confirmed:100},{...previous,id:"OUTSIDE-AFTER",date:dayOffset(today,2),confirmed:100});
  await page.addInitScript(data=>localStorage.setItem("ecodump-narita-preview-v1",JSON.stringify(data)),{day:today,trips});
  await page.goto(`${entry}&page=results`);
  const quantity=page.locator(".construction-quantity-grid article").filter({has:page.locator("header b",{hasText:"m³"})});
  await expect(quantity).toContainText("期間内累計");
  const confirmed=quantity.locator("dl > div").filter({has:page.getByText("受入確定",{exact:true})}).locator("dd");
  await expect(confirmed).toHaveText("6.8");
  await page.getByLabel("開始日",{exact:true}).fill(yesterday);await page.getByLabel("終了日",{exact:true}).fill(tomorrow);
  await expect(confirmed).toHaveText("10.8");
  await expect(page.locator(".results-table-wrap tbody tr")).toHaveCount(8);
  await expect(page.locator(".results-period-total")).toContainText(`${yesterday}〜${tomorrow}`);
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Excel帳票",exact:true}).click();
  const book=XLSX.readFile(await(await download).path());const summary=XLSX.utils.sheet_to_json(book.Sheets["集計"],{header:1}),detail=XLSX.utils.sheet_to_json(book.Sheets["便別明細"],{header:1});
  expect(detail.slice(1).map(row=>row[1])).toContain("PERIOD-PREVIOUS");expect(detail.slice(1)).toHaveLength(8);
  expect(detail.flat()).not.toContain("OUTSIDE-BEFORE");expect(detail.flat()).not.toContain("OUTSIDE-AFTER");
  expect(summary.find(row=>row[0]==="受入確定数量"&&row[1]==="m³")[2]).toBeCloseTo(10.8);
  await page.getByRole("combobox",{name:"受入先",exact:true}).selectOption("茨城モデル採石場〈架空〉");
  await expect(confirmed).toHaveText("0.0");
  await expect(page.locator(".results-period-total")).toContainText("茨城モデル採石場");
});
