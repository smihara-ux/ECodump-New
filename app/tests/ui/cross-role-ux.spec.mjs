import {test,expect} from '@playwright/test';
import {demoDay,dayOffset,createNaritaDemo} from '../../src/demo/model.mjs';
import XLSX from 'xlsx';
const base='/?preview=app&demo=1';
const construction=page=>`${base}&role=construction&navigationReview=1&page=${page}`;
const receiving=page=>`${base}&role=receiving&page=${page}`;
async function counts(page){
  const cards=page.locator('.vehicle-metrics > :is(button,article)');
  await expect(cards).toHaveCount(4);
  for(const [i,label]of ['予定台数 実3台 延べ5台 未配車1件','受入完了台数 実1台 延べ1台','受入待ち台数 実3台 延べ4台 未配車1件','取消台数 実1台 延べ1台'].entries())await expect(cards.nth(i)).toHaveAttribute('aria-label',label);
}
for(const theme of ['light','dark'])for(const width of [1440,390])test(`shared counts and distinct receiving confirmation; ${theme} ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.addInitScript(t=>{localStorage.setItem('ecodump-theme',t);localStorage.setItem('ecodump-driver-theme',t);},theme);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const url of [construction('transport'),receiving('transport'),receiving('control')]){await page.goto(url);await counts(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);}
  await page.getByRole('button',{name:/^受入待ち台数/}).click();await expect(page.locator('.timeline-list > button')).toHaveCount(4);
  await page.getByRole('button',{name:/^取消台数/}).click();await expect(page.locator('.timeline-list > button')).toHaveCount(1);
  await page.goto(receiving('transport'));await page.getByRole('button',{name:/^受入完了台数/}).click();await expect(page.getByLabel('運搬・受付状態')).toHaveValue('受入完了');
  await expect(page.locator('.receiving-card').filter({has:page.getByRole('heading',{name:'栃木モデル採石場〈架空〉',exact:true})})).toHaveCount(1);
  await page.getByLabel('運搬・受付状態').selectOption('未確認伝票');await page.reload();await expect(page.getByLabel('運搬・受付状態')).toHaveValue('未確認伝票');
  await page.goto('/?app=driver&demo=1');await page.locator('.driver-count-disclosure > summary').click();
  await expect(page.locator('[data-vehicle-state="有効予定"]')).toHaveAttribute('aria-label','予定台数 実2台 延べ3台');
  await expect(page.locator('[data-vehicle-state="受入完了"]')).toHaveAttribute('aria-label','受入完了台数 実1台 延べ1台');
  await page.getByRole('button',{name:/^受入待ち台数/}).click();await expect(page.locator('.trip-card')).toHaveCount(2);
  const clipping=await page.locator('.vehicle-metrics > button').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2).map(e=>e.textContent));expect(clipping).toEqual([]);
  await page.locator('.driver-bottom').getByRole('button',{name:'運行履歴',exact:true}).click();await expect(page.locator('.history-date').first()).toContainText('受入確認済み 6.8 m³');
  expect(errors).toEqual([]);
});
test('receiving list filters survive detail, module navigation and reload; back returns to the original list',async({page})=>{
  await page.goto(receiving('receiving-reservations'));await page.getByLabel('予約を検索',{exact:true}).fill('TR-20260820-02');
  await page.getByRole('button',{name:'TR-20260820-02の予約詳細'}).click();await page.getByRole('button',{name:'← 予約一覧へ',exact:true}).click();
  await expect(page.getByLabel('予約を検索',{exact:true})).toHaveValue('TR-20260820-02');
  await page.reload();await expect(page.getByLabel('予約を検索',{exact:true})).toHaveValue('TR-20260820-02');
  await page.goto(receiving('receiving-results'));await page.getByLabel('検索',{exact:true}).fill('TR-20260820-01');
  await page.getByRole('button',{name:'TR-20260820-01の予約詳細'}).click();await page.getByRole('button',{name:'← 受入実績へ戻る',exact:true}).click();
  await expect(page.getByLabel('検索',{exact:true})).toHaveValue('TR-20260820-01');
});
test('receiving confirmation updates construction counts and driver history for the same trip',async({page})=>{
  await page.goto(receiving('receiving-reservations'));await page.getByRole('button',{name:'TR-20260820-05の予約詳細'}).click();
  await page.getByLabel('実績数量（m³）',{exact:true}).fill('7.3');await page.getByLabel('判断・変更・差異の理由').fill('原票と数量を確認');
  await page.getByRole('button',{name:'受入内容を確認（試作）'}).click();await page.getByRole('button',{name:'実績確定の確認へ'}).click();await page.getByRole('button',{name:'この内容で実績確定を試す'}).click();
  await page.goto(construction('transport'));await expect(page.locator('[data-vehicle-state="受入完了"]')).toHaveAttribute('aria-label','受入完了台数 実1台 延べ2台');
  await page.goto('/?app=driver&demo=1');await page.locator('.driver-bottom').getByRole('button',{name:'運行履歴',exact:true}).click();await expect(page.locator('.history-date').last()).toContainText('受入確認済み 7.3 m³');
});
test('receiver period total and Excel use the same endpoints, filters and actual/extended counts',async({page})=>{
  const today=demoDay(),rows=createNaritaDemo(today),prev={...rows[0],date:dayOffset(today,-1),id:'PREVIOUS-DAY',confirmed:4};
  rows.push(prev,{...prev,date:dayOffset(today,-2),id:'OUTSIDE-PERIOD',confirmed:100});await page.addInitScript(data=>localStorage.setItem('ecodump-narita-preview-v1',JSON.stringify(data)),{day:today,trips:rows});
  await page.goto(receiving('receiving-results'));await page.getByLabel('開始日',{exact:true}).fill(dayOffset(today,-1));await page.getByLabel('終了日',{exact:true}).fill(today);
  await expect(page.locator('.receiving-period-total')).toContainText(`${dayOffset(today,-1)}〜${today}`);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Excel帳票を出力',exact:true}).click();const book=XLSX.readFile(await(await download).path());
  const data=book.SheetNames.map(n=>XLSX.utils.sheet_to_json(book.Sheets[n],{header:1}));expect(data.flat(2)).toContain('PREVIOUS-DAY');expect(data.flat(2)).not.toContain('OUTSIDE-PERIOD');
  expect(JSON.stringify(data)).toContain('実3台／延べ6台');await expect(page.locator('.receiving-report-total').filter({has:page.locator('b',{hasText:'m³'})})).toContainText('10.8');
});
test('driver returns to the same scroll and preserves history search/date after reload',async({page})=>{
  await page.goto('/?app=driver&demo=1');await page.locator('.driver-bottom').getByRole('button',{name:'運行履歴',exact:true}).click();
  await page.getByLabel('日付・便番号・現場で検索').fill('A工区');await page.locator('.trip-card').last().scrollIntoViewIfNeeded();
  const before=await page.locator('.driver-content').evaluate(e=>e.scrollTop);await page.locator('.trip-card').last().click();await page.getByRole('button',{name:'運行履歴へ戻る',exact:true}).click();
  expect(await page.locator('.driver-content').evaluate(e=>e.scrollTop)).toBeCloseTo(before,0);await page.reload();await expect(page.getByRole('heading',{name:'運行履歴',exact:true})).toBeVisible();await expect(page.getByLabel('日付・便番号・現場で検索')).toHaveValue('A工区');
});
