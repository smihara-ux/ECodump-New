import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {demoSites} from '../../src/demo/model.mjs';
const entry='/?preview=app&role=construction&demo=1&navigationReview=1';
const evidence='../tmp/ux-completion-2026-10-09/flows';
const siteA=demoSites[0],siteB=demoSites[1];
async function fieldCompanies(page,name=siteA.name){
  await page.getByRole('combobox',{name:'現場',exact:true}).selectOption(name);
  const details=page.locator('.review-field-context > details');
  if(!await details.evaluate(e=>e.open))await details.locator(':scope > summary').click();
  await page.getByRole('combobox',{name:'現場の詳細項目',exact:true}).selectOption('協力会社');
}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);}
for(const theme of ['dark','light'])for(const width of [390,1440])test(`site/company/documents update and nested return after reload ${theme} ${width}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:width===390?844:1000});await page.addInitScript(t=>localStorage.setItem('ecodump-theme',t),theme);
  await page.goto(`${entry}&page=transport`);await fieldCompanies(page);
  await expect(page.locator('.review-site-company')).toHaveCount(2);
  await expect(page.locator('.review-site-companies')).not.toContainText('サンプル設備工業');
  const company=page.locator('.review-site-company[data-company-id="NC-03"]');
  await expect(company).toHaveAttribute('data-site-id',siteA.id);await expect(company).toContainText('招待未対応');
  await page.getByRole('combobox',{name:'受入先',exact:true}).selectOption('栃木モデル採石場〈架空〉');
  await company.getByRole('button',{name:'会社・参加情報を確認',exact:true}).scrollIntoViewIfNeeded();
  const scroll=await page.locator('.navigation-review-main').evaluate(e=>e.scrollTop);expect(scroll).toBeGreaterThan(100);
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecodump-compliance-demo-v1')||'null'));
  await company.getByRole('button',{name:'会社・参加情報を確認',exact:true}).click();
  await expect(page.locator('.review-company-detail')).toHaveAttribute('data-site-id',siteA.id);await expect(page).toHaveURL(/reviewCompany=NC-03/);
  await page.getByLabel('担当者名',{exact:true}).fill('連携確認担当');await page.getByLabel('招待先メール',{exact:true}).fill('review-flow@example.invalid');
  await page.getByRole('button',{name:'登録内容をデモ内で確認',exact:true}).click();
  await expect(page.locator('.review-company-detail')).toContainText('登録内容確認待ち');
  await page.reload();await expect(page.getByLabel('担当者名',{exact:true})).toHaveValue('連携確認担当');
  await page.getByRole('button',{name:'不足書類確認・提出へ',exact:true}).click();
  await expect(page.locator('.review-document-company')).toHaveCount(1);await expect(page.locator('.review-document-company')).toHaveAttribute('data-site-id',siteA.id);
  await page.getByRole('combobox',{name:'表示する書類',exact:true}).selectOption('許可情報');await page.getByRole('button',{name:'確認・提出・履歴',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('checkbox',{name:'建設業許可情報',exact:true}).check();await dialog.getByRole('checkbox',{name:'運送事業許可情報',exact:true}).check();
  await dialog.getByRole('button',{name:'仮提出（デモ）',exact:true}).click();await expect(dialog).toContainText('提出済');await expect(dialog).toContainText('第2版');
  await dialog.getByRole('button',{name:'書類確認を閉じる',exact:true}).click();
  await page.getByRole('button',{name:'労務安全で詳しく確認',exact:true}).click();await page.reload();
  await expect(page.locator('.review-document-company')).toHaveCount(1);await expect(page.locator('.review-document-row')).toContainText('提出済');
  await page.getByRole('button',{name:'会社詳細へ戻る',exact:true}).click();
  await expect(page.locator('.review-company-detail')).toHaveAttribute('data-company-id','NC-03');await expect(page.locator('.review-company-detail')).toHaveAttribute('data-site-id',siteA.id);
  await page.reload();await page.getByRole('button',{name:'現場・搬出管理へ戻る',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'現場',exact:true})).toHaveValue(siteA.name);
  await expect(page.getByRole('combobox',{name:'受入先',exact:true})).toHaveValue('栃木モデル採石場〈架空〉');
  await expect(page.getByRole('combobox',{name:'現場の詳細項目',exact:true})).toHaveValue('協力会社');
  await expect(company).toContainText('登録内容確認待ち');await expect(company).toContainText('連携確認担当');await expect(company).toContainText('5カテゴリ');
  await expect.poll(()=>page.locator('.navigation-review-main').evaluate(e=>e.scrollTop)).toBeGreaterThan(scroll-80);
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecodump-compliance-demo-v1')));
  expect(state.records).toHaveLength(18);expect(state.records.find(r=>r.id==='NC-03:許可情報').history).toHaveLength(3);
  expect(state.records.filter(r=>r.id!=='NC-03:許可情報').every(r=>r.version===1)).toBe(true);
  expect(original===null||original.records.length===state.records.length).toBe(true);
  await noOverflow(page);mkdirSync(evidence,{recursive:true});await page.screenshot({path:`${evidence}/${theme}-${width}-site-synced.png`});
  // Empty sites must not borrow site A companies, even after a shared update.
  await page.getByRole('combobox',{name:'受入先',exact:true}).selectOption('すべて');await fieldCompanies(page,siteB.name);await expect(page.locator('.review-site-company')).toHaveCount(0);await expect(page.locator('.review-site-companies')).toContainText('参加情報はありません');
  await noOverflow(page);expect(errors).toEqual([]);
});
test('new participation stays independent at all 23 site options and survives reload',async({page})=>{
  await page.goto(`${entry}&page=agency-request`);await expect(page.getByRole('combobox',{name:'参加現場',exact:true}).locator('option')).toHaveCount(23);
  await page.getByRole('combobox',{name:'既存の会社',exact:true}).selectOption('NC-03');await page.getByRole('combobox',{name:'参加現場',exact:true}).selectOption(siteB.id);
  await expect(page.getByRole('button',{name:'不足書類確認・提出へ',exact:true})).toBeDisabled();
  await page.getByLabel('担当者名',{exact:true}).fill('B現場担当');await page.getByLabel('招待先メール',{exact:true}).fill('site-b@example.invalid');await page.getByRole('button',{name:'登録内容をデモ内で確認',exact:true}).click();
  await page.reload();await expect(page.getByRole('combobox',{name:'参加現場',exact:true})).toHaveValue(siteB.id);await expect(page.getByLabel('担当者名',{exact:true})).toHaveValue('B現場担当');
  await page.getByRole('button',{name:'不足書類確認・提出へ',exact:true}).click();await expect(page.locator('.review-document-company')).toHaveAttribute('data-site-id',siteB.id);await expect(page.locator('.review-document-row')).toHaveCount(1);
  await page.getByRole('button',{name:'代行登録申請へ戻る',exact:true}).click();
  await page.goto(`${entry}&page=transport`);await fieldCompanies(page,siteB.name);await expect(page.locator('.review-site-company')).toHaveCount(1);await expect(page.locator('.review-site-company')).toContainText('B現場担当');
  await fieldCompanies(page,siteA.name);await expect(page.locator('.review-site-company')).toHaveCount(2);await expect(page.locator('.review-site-company[data-company-id="NC-03"]')).toContainText('招待未対応');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('ecodump-compliance-demo-v1')));expect(state.records).toHaveLength(24);expect(state.records.find(r=>r.id==='NC-03:許可情報').checks).toEqual([]);
});
test('browser back and forward preserve the site and opened detail',async({page})=>{
  await page.goto(`${entry}&page=transport`);await fieldCompanies(page);await page.locator('.review-site-company[data-company-id="NC-03"]').getByRole('button',{name:'不足書類を確認',exact:true}).click();
  await expect(page.locator('.review-document-company')).toHaveCount(1);await page.goBack();await expect(page.getByRole('combobox',{name:'現場の詳細項目',exact:true})).toHaveValue('協力会社');await expect(page.getByRole('combobox',{name:'現場',exact:true})).toHaveValue(siteA.name);
  await page.goForward();await expect(page.locator('.review-company-detail')).toHaveAttribute('data-site-id',siteA.id);await expect(page.locator('.review-document-company')).toHaveCount(1);
});
test('relations search and scoped participant return after reload',async({page})=>{
  await page.goto(`${entry}&page=agencies`);await page.getByLabel('会社名で検索',{exact:true}).fill('協力会社 B');await page.getByRole('button',{name:'詳細',exact:true}).click();
  await page.getByRole('tab',{name:/不足書類/}).click();await page.getByRole('button',{name:'労務安全で詳しく確認',exact:true}).click();await page.reload();await page.getByRole('button',{name:'会社詳細へ戻る',exact:true}).click();
  await page.getByRole('button',{name:'会社一覧へ戻る',exact:true}).click();await expect(page.getByLabel('会社名で検索',{exact:true})).toHaveValue('協力会社 B');await expect(page.locator('.review-relations-table tbody tr')).toHaveCount(1);
});
test('last existing site can register and show the same participation in all three workspaces',async({page})=>{
  await page.goto(`${entry}&page=agency-request`);
  const site=page.getByRole('combobox',{name:'参加現場',exact:true});const last=await site.locator('option').last().getAttribute('value');const name=await site.locator('option').last().textContent();
  await site.selectOption(last);await page.getByLabel('担当者名',{exact:true}).fill('最終現場担当');await page.getByLabel('招待先メール',{exact:true}).fill('last-site@example.invalid');await page.getByRole('button',{name:'登録内容をデモ内で確認',exact:true}).click();
  await page.goto(`${entry}&page=transport`);await fieldCompanies(page,name);await expect(page.locator('.review-site-company')).toHaveAttribute('data-site-id',last);await expect(page.locator('.review-site-company')).toContainText('最終現場担当');
  await page.locator('.review-site-company').getByRole('button',{name:'不足書類を確認',exact:true}).click();await expect(page.locator('.review-company-detail')).toContainText(name);await expect(page.locator('.review-document-company')).toContainText(name);await expect(page.locator('.review-document-row')).toHaveCount(6);
  await page.goto(`${entry}&page=labor`);await page.locator('main .service-menu').getByRole('button',{name:'配下協力会社検索',exact:true}).click();
  await page.getByRole('combobox',{name:'参加現場',exact:true}).selectOption(last);await expect(page.locator('.gf-table tbody tr')).toHaveCount(1);await expect(page.locator('.gf-table tbody tr')).toContainText(name);
});
test('another tab update refreshes the site participation and document counts',async({page,context})=>{
  await page.goto(`${entry}&page=transport`);await fieldCompanies(page);
  const other=await context.newPage();await other.goto(`${entry}&page=agencies&reviewCompany=NC-03&reviewSite=${siteA.id}`);
  await other.getByRole('tab',{name:'現場参加情報',exact:true}).click();await other.getByLabel('担当者名',{exact:true}).fill('別タブ担当');await other.getByLabel('招待先メール',{exact:true}).fill('another-tab@example.invalid');await other.getByRole('button',{name:'登録内容をデモ内で確認',exact:true}).click();
  const card=page.locator('.review-site-company[data-company-id="NC-03"]');await expect(card).toContainText('別タブ担当');await expect(card).toContainText('登録内容確認待ち');
  await other.getByRole('tab',{name:/不足書類/}).click();await other.getByRole('combobox',{name:'表示する書類',exact:true}).selectOption('許可情報');await other.getByRole('button',{name:'確認・提出・履歴',exact:true}).click();
  await other.getByRole('checkbox',{name:'建設業許可情報',exact:true}).check();await other.getByRole('checkbox',{name:'運送事業許可情報',exact:true}).check();await expect(card).toContainText('5カテゴリ');
});
test('failed local save retains input and does not report a successful update',async({page})=>{
  await page.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='ecodump-compliance-demo-v1')throw new DOMException('Quota exceeded','QuotaExceededError');return set.call(this,key,value);};});
  await page.goto(`${entry}&page=agency-request`);await page.getByLabel('担当者名',{exact:true}).fill('保存前の担当者');await page.getByLabel('招待先メール',{exact:true}).fill('keep@example.invalid');await page.getByRole('button',{name:'登録内容をデモ内で確認',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('端末に保存できません');await expect(page.getByLabel('担当者名',{exact:true})).toHaveValue('保存前の担当者');await expect(page.getByRole('status',{exact:true}).filter({hasText:'状態：'})).toContainText('招待未対応');
  expect(await page.evaluate(()=>localStorage.getItem('ecodump-compliance-demo-v1'))).toBeNull();
});
