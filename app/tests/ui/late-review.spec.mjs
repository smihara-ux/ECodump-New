import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
test.use({locale:'ja-JP'});
const entry='/?preview=app&role=construction&demo=1&navigationReview=1';
const folder=process.env.ECODUMP_UI_AUDIT_DIR || '../tmp/ux-audit-2026-10-08/late-all-pages';
const categories=['一括提出書類','個別提出書類','許可情報','契約情報','保険加入証明書','主任技術者'];
const fields=['概要','搬出条件','搬出予定','車両・運転手','運行状況','搬出入記録・写真・伝票','数量実績','書類','協力会社'];
async function choose(page,label,width){if(width<=1024)await page.locator('.navigation-review-mobile select').selectOption(label);else await page.locator('main .service-menu').getByRole('button',{name:label,exact:true}).click();}
for(const theme of ['dark','light'])for(const width of [1440,390])test(`all construction pages and items ${theme} ${width}`,async({page})=>{
  test.setTimeout(90000);page.setDefaultTimeout(8000);mkdirSync(folder,{recursive:true});
  await page.setViewportSize({width,height:width<800?844:1000});await page.addInitScript(t=>localStorage.setItem('ecodump-theme',t),theme);
  const errors=[],audit=[];page.on('pageerror',e=>errors.push(e.message));
  async function capture(name){
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),name).toBeLessThanOrEqual(2);
    const clipping=await page.locator('.navigation-review-main').evaluate(main=>[...main.querySelectorAll('button,input,select')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').filter(e=>e.clientWidth>0&&(e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2)).map(e=>({text:e.textContent?.trim()||e.getAttribute('aria-label'),width:e.clientWidth,scroll:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight})));
    audit.push({name,clipping});
    if(await page.locator('.leaflet-map').count()) await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].every(e=>e.complete&&e.naturalWidth>0),null,{timeout:5000}).catch(()=>{});
    await page.screenshot({path:`${folder}/${theme}-${width}-${name}.png`});
  }
  await page.goto(`${entry}&page=company`);
  for(const label of ['本社情報','CCUS連携情報','労務安全項目','支店情報']){await choose(page,label,width);await capture(`company-${label}`);}
  for(const [label,select] of [['ユーザー','ユーザー一覧'],['車両','車両一覧'],['ドライバー検索','ドライバー検索']]){await choose(page,width<=1024?select:label,width);await capture(`master-${label}`);}
  const action=page.getByRole('button',{name:'ドライバー情報',exact:true}).first();
  expect(await action.evaluate(e=>{const range=document.createRange();range.selectNodeContents(e);const rect=range.getBoundingClientRect();return rect.height/parseFloat(getComputedStyle(e).lineHeight);})).toBeLessThan(1.2);
  await action.click();await expect(page.getByRole('dialog')).toContainText('電話番号');await capture('driver-detail');await page.getByRole('button',{name:'閉じる',exact:true}).last().click();
  await page.goto(`${entry}&page=transport`);await expect(page.locator('.review-site-row')).toHaveCount(23);await expect(page.locator('.review-field-picker')).toHaveCount(0);
  const boxes=await page.locator('.review-site-row').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,bottom:r.bottom};}));
  for(let i=1;i<boxes.length;i++){expect(boxes[i].x).toBe(boxes[0].x);expect(boxes[i].width).toBe(boxes[0].width);expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i-1].bottom-1);}
  await page.locator('.review-site-row').first().evaluate(e=>e.scrollIntoView({block:'start'}));await capture('sites-first');await page.locator('.review-site-row').last().scrollIntoViewIfNeeded();await capture('sites-last');
  await page.locator('.review-site-row[data-field-id="32184"]').getByRole('button',{name:'現場詳細を開く',exact:true}).click();await page.locator('.review-site-inline-detail').getByLabel('現場の詳細項目').selectOption('搬出予定');await expect(page.locator('.review-site-empty')).toHaveCount(1);await capture('sites-empty');
  await page.getByRole('combobox',{name:'現場',exact:true}).selectOption('成田空港モデル現場 A工区');
  for(const field of fields){
    const selector=page.getByRole('combobox',{name:'現場の詳細項目',exact:true});
    await selector.selectOption(field);
    await selector.evaluate(e=>e.scrollIntoView({block:'start'}));
    await capture(`field-${field}`);
  }
  await page.goto(`${entry}&page=dispatch`);await expect(page.getByRole('combobox',{name:'現場',exact:true}).locator('option')).toHaveCount(24);await page.getByRole('combobox',{name:'現場',exact:true}).selectOption('すべて');await capture('dispatch');
  await page.getByRole('button',{name:'予定を追加',exact:true}).click();await capture('dispatch-add');await page.getByRole('button',{name:'予定追加を閉じる',exact:true}).click();
  await page.getByRole('button',{name:'前日・前週からコピー',exact:true}).click();await capture('dispatch-copy');await page.getByRole('button',{name:'前日・前週からコピー',exact:true}).click();
  await page.getByRole('button',{name:'詳細・操作',exact:true}).first().click();
  for(const label of ['概要','担当変更','取消','履歴']){await page.getByRole('tab',{name:label,exact:true}).click();await capture(`dispatch-detail-${label}`);}
  await page.getByRole('button',{name:'割当編集を閉じる',exact:true}).click();
  await page.goto(`${entry}&page=control`);await page.getByRole('combobox',{name:'現場',exact:true}).selectOption('すべて');await capture('operations');
  await page.locator('.review-timeline > button').first().click();await capture('operations-map');await page.getByRole('button',{name:'地図を拡張表示',exact:true}).click();await capture('operations-expanded');await page.getByRole('button',{name:'拡張表示を閉じる',exact:true}).click();
  await page.goto(`${entry}&page=labor`);await expect(page.locator('main .service-menu').getByRole('button',{name:'ドライバー検索',exact:true})).toHaveCount(0);
  await expect(page.locator('.review-document-company')).toHaveCount(3);await expect(page.locator('.review-document-row')).toHaveCount(18);await capture('documents-all');
  for(const c of categories){await page.getByRole('combobox',{name:'表示する書類',exact:true}).selectOption(c);await capture(`documents-${c}`);}
  await page.getByRole('button',{name:'確認・提出・履歴',exact:true}).last().click();await capture('document-detail');await page.getByRole('button',{name:'書類確認を閉じる',exact:true}).click();
  for(const label of ['元請帳票の確認','配下協力会社検索']){await choose(page,label,width);await capture(`labor-${label}`);}
  await page.goto(`${entry}&page=results`);await capture('results');
  await page.goto(`${entry}&page=agencies`);await capture('relations-cooperative');await page.getByRole('button',{name:'詳細',exact:true}).last().click();
  for(const label of ['会社情報','現場参加情報','不足書類']){await page.getByRole('tab',{name:new RegExp(`^${label}`)}).click();await capture(`relations-detail-${label}`);}
  await page.getByRole('button',{name:'会社一覧へ戻る',exact:true}).click();
  await choose(page,width<=1024?'代行登録申請':'登録申請',width);await capture('relations-register');await choose(page,width<=1024?'自社の代行元一覧':'元請会社',width);await capture('relations-prime');
  expect(errors).toEqual([]);writeFileSync(`${folder}/audit-${theme}-${width}.json`,JSON.stringify({theme,width,errors,pages:audit},null,2));
  // Inputs deliberately scroll their text. Visible buttons must never clip text.
  expect(audit.flatMap(x=>x.clipping.filter(c=>c.text).map(c=>({page:x.name,...c}))), 'control clipping').toEqual([]);
});
for(const width of [1440,1920,390])test(`map zoom and expansion preserve context ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width<800?844:1000});await page.goto(`${entry}&page=control`);
  await expect(page.getByRole('combobox',{name:'現場',exact:true}).locator('option')).toHaveCount(24);
  await page.locator('.leaflet-map').scrollIntoViewIfNeeded();const zoom=page.getByRole('status',{name:'地図のズーム',exact:true});const start=Number(await zoom.textContent());
  await page.getByRole('button',{name:'地図を拡大',exact:true}).click();await expect(zoom).toHaveText((start+.5).toFixed(2));
  await page.locator('.leaflet-map').hover();await page.mouse.wheel(0,-300);await expect(zoom).toHaveText((start+.5).toFixed(2));
  await page.locator('.review-timeline > button').filter({hasText:'TR-20260820-03'}).click();await expect(zoom).toHaveText((start+.5).toFixed(2));
  await page.getByRole('button',{name:'地図を拡張表示',exact:true}).click();await expect(page.locator('.control-topbar')).toBeVisible();if(width>1024){await expect(page.locator('.sidebar')).toBeVisible();await expect(page.locator('main .service-menu')).toBeVisible();}
  const body=await page.locator('.navigation-review-main').boundingBox(),map=await page.locator('.leaflet-map').boundingBox();expect(map.width).toBeGreaterThan(body.width-35);expect(map.y).toBeGreaterThanOrEqual(body.y);expect(map.y+map.height).toBeLessThanOrEqual(body.y+body.height);expect(map.height).toBeGreaterThan(width<800?250:450);
  await page.keyboard.press('Escape');await expect(page.locator('.review-timeline')).toBeVisible();await expect(zoom).toHaveText((start+.5).toFixed(2));await expect(page.locator('.map-selection')).toContainText('TR-20260820-03');
  await page.getByRole('combobox',{name:'現場',exact:true}).selectOption({index:23});await expect(page.locator('.review-timeline')).toContainText('対象便はありません');await expect(page.locator('.leaflet-map')).toHaveCount(0);
});
