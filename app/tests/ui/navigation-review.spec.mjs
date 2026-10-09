import {expect,test} from '@playwright/test';
const evidence=process.env.ECODUMP_UI_AUDIT_DIR || '../tmp/ux-audit-2026-10-08';
const entry='/?preview=app&role=construction&demo=1&navigationReview=1';
const sections=['本社情報','CCUS連携情報','労務安全項目','支店情報'];
const categories=['一括提出書類','個別提出書類','許可情報','契約情報','保険加入証明書','主任技術者'];
async function module(page,name,width){if(width<=760)await page.locator('.mobile-menu').click();else if(width<=1024&&await page.locator('.sidebar .collapse').getAttribute('aria-expanded')==='false')await page.locator('.sidebar .collapse').click();await page.locator('.sidebar').getByRole('button',{name,exact:true}).click();if(width<=1024&&await page.locator('.sidebar .collapse').getAttribute('aria-expanded')==='true')await page.locator('.sidebar .collapse').click();}
async function choose(page,name,width){if(width<=1024)await page.locator('.navigation-review-mobile select').selectOption(name);else await page.locator('main .service-menu').getByRole('button',{name,exact:true}).click();}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);}
for(const theme of ['light','dark'])for(const width of [390,768,1440,1920])test(`consolidated pages and readable layouts ${theme} ${width}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(t=>localStorage.setItem('ecodump-theme',t),theme);
  await page.setViewportSize({width,height:width<800?844:1000});
  await page.goto(`${entry}&page=company`);
  await expect(page.locator('.company-tabs')).toHaveCount(0);
  for(const section of sections){await choose(page,section,width);await expect(page.locator('.company-workspace').getByRole('heading',{name:section,exact:true,level:2})).toBeVisible();}
  await choose(page,'本社情報',width);
  await page.screenshot({path:`${evidence}/late-company-${theme}-${width}.png`});await noOverflow(page);
  for(const [label,url] of [['ユーザー','users'],['車両','vehicles'],['ドライバー検索','drivers']]){await choose(page,width<=1024?({'ユーザー':'ユーザー一覧','車両':'車両一覧'}[label]||label):label,width);await expect(page).toHaveURL(new RegExp(`page=${url}`));await noOverflow(page);}
  await module(page,'施工管理',width);
  await expect(page.locator('main .service-menu').getByRole('button',{name:'現場管理',exact:true})).toHaveCount(0);
  await page.getByRole('combobox',{name:'現場',exact:true}).selectOption('成田空港モデル現場 B工区');
  await expect(page.locator('.construction-trip-group > header h2')).toHaveText('成田空港モデル現場 B工区');
  await expect(page.locator('.construction-trip-list')).not.toContainText('成田空港モデル現場 A工区');
  await page.locator('.review-field-context summary').click();
  const fieldMenu=page.getByRole('combobox',{name:'現場の詳細項目',exact:true});
  for(const section of ['搬出条件','車両・運転手','運行状況','搬出入記録・写真・伝票','数量実績','書類','協力会社','概要']){await fieldMenu.selectOption(section);await noOverflow(page);}
  await page.locator('.review-field-context > details > summary').click();
  await page.screenshot({path:`${evidence}/late-construction-${theme}-${width}.png`});
  await module(page,'運行管理',width);await expect(page.locator('.daily-plan-form')).toBeHidden();
  await page.getByRole('button',{name:'予定を追加',exact:true}).click();await expect(page.locator('.daily-plan-form')).toBeVisible();
  await page.getByRole('button',{name:'予定追加を閉じる',exact:true}).click();
  await page.getByRole('button',{name:'詳細・操作',exact:true}).first().click();
  await expect(page.getByRole('dialog')).toContainText('配車版');
  await page.getByRole('tab',{name:'履歴',exact:true}).click();await expect(page.getByRole('heading',{name:'変更前後・適用日時'})).toBeVisible();
  await page.getByRole('button',{name:'割当編集を閉じる',exact:true}).click();
  await choose(page,width<=1024?'運行管制':'運行ダッシュボード',width);
  await page.getByRole('combobox',{name:'現場',exact:true}).selectOption('すべて');
  await expect(page.locator('.review-metrics')).toContainText('有効予定5便');await expect(page.locator('.review-metrics')).toContainText('取消1便');
  await expect(page.getByText('本日の運行サマリー',{exact:true})).toHaveCount(0);
  await page.locator('.navigation-review-main').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:`${evidence}/late-operations-${theme}-${width}.png`});
  const before=await page.locator('.leaflet-map').boundingBox();
  await page.locator('.review-timeline > button').filter({hasText:'TR-20260820-03'}).click();
  expect(Math.abs((await page.locator('.leaflet-map').boundingBox()).width-before.width)).toBeLessThan(2);
  expect(before.width).toBeGreaterThan(width<800?250:700);
  await expect(page.locator('.map-selection')).toContainText('成田空港モデル現場 A工区');await expect(page.locator('.map-selection')).toContainText('茨城モデル採石場');
  const map=await page.locator('.leaflet-map').boundingBox(),card=await page.locator('.map-selection').boundingBox();expect(card.y).toBeGreaterThanOrEqual(map.y+map.height);
  await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].every(e=>e.complete&&e.naturalWidth>0),null,{timeout:5000}).catch(()=>{});
  await page.locator('.review-map-section').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${evidence}/late-map-${theme}-${width}.png`});
  await page.getByRole('button',{name:'便一覧へ戻る',exact:true}).click();
  await page.getByRole('button',{name:/未手配\s*1\s*便/}).click();await expect(page.locator('.review-timeline')).toContainText('未手配');await expect(page.locator('.review-timeline')).not.toContainText('現場待機中');
  await page.getByRole('button',{name:'すべての便を表示',exact:true}).click();await expect(page.locator('.review-timeline > button')).toHaveCount(6);await expect(page).toHaveURL(/page=control/);await noOverflow(page);
  await module(page,'労務安全',width);await expect(page.locator('.gf-tabs')).toHaveCount(0);
  for(const category of categories){await page.getByRole('combobox',{name:'表示する書類',exact:true}).selectOption(category);await expect(page.locator('.review-document-row h4')).toHaveText([category,category,category]);await noOverflow(page);}
  await page.screenshot({path:`${evidence}/late-labor-${theme}-${width}.png`});
  await module(page,'実績管理',width);await expect(page.getByRole('heading',{name:'搬出実績',exact:true})).toBeVisible();await noOverflow(page);
  await module(page,'関係会社',width);await page.getByRole('button',{name:'詳細',exact:true}).last().click();
  await expect(page).toHaveURL(/page=agencies/);await expect(page.locator('.review-company-detail h2').first()).toContainText('協力会社 B');
  await page.getByRole('tab',{name:'現場参加情報',exact:true}).click();await expect(page.getByRole('button',{name:'登録内容をデモ内で確認',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'不足書類確認・提出へ',exact:true}).click();await expect(page).toHaveURL(/page=agencies/);
  await expect(page.locator('.review-document-company')).toHaveCount(1);
  await page.screenshot({path:`${evidence}/late-company-detail-${theme}-${width}.png`});
  await page.getByRole('button',{name:'労務安全で詳しく確認',exact:true}).click();await expect(page).toHaveURL(/page=labor/);await expect(page.locator('.review-document-company')).toHaveCount(1);
  await page.getByRole('button',{name:'会社詳細へ戻る',exact:true}).click();await expect(page.locator('.review-company-detail h2').first()).toContainText('協力会社 B');await noOverflow(page);
  expect(errors).toEqual([]);
});
test('company drafts and fixed controls survive inner-menu selection',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(`${entry}&page=company`);
  await choose(page,'労務安全項目',1440);await page.getByRole('button',{name:'編集',exact:true}).click();await page.getByLabel('代表者情報 代表者名',{exact:true}).fill('検証担当');
  const toolbar=await page.locator('.company-actions').boundingBox();await page.locator('.company-details-scroll').evaluate(e=>e.scrollTop=500);
  expect((await page.locator('.company-actions').boundingBox()).y).toBe(toolbar.y);
  await choose(page,'本社情報',1440);await choose(page,'労務安全項目',1440);await expect(page.getByLabel('代表者情報 代表者名',{exact:true})).toHaveValue('検証担当');
  await page.getByRole('button',{name:'キャンセル',exact:true}).click();await expect(page.locator('.company-details-scroll')).toContainText('サンプル 太郎');
});
test('regular construction and receiving remain outside local review',async({page})=>{
  await page.goto('/?preview=app&role=construction&page=company&demo=1');await expect(page.getByRole('tab',{name:'本社情報',exact:true})).toBeVisible();await expect(page.locator('.navigation-review')).toHaveCount(0);
  await page.goto('/?preview=app&role=receiving&page=transport&demo=1&navigationReview=1');await expect(page.locator('.navigation-review')).toHaveCount(0);
});
test('company-scoped document updates use the retained submission and history',async({page})=>{
  await page.goto(`${entry}&page=agencies&reviewCompany=NC-03`);
  await page.getByRole('tab',{name:/不足書類/}).click();
  await page.getByRole('combobox',{name:'表示する書類',exact:true}).selectOption('許可情報');
  await page.getByRole('button',{name:'確認・提出・履歴',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('checkbox',{name:'建設業許可情報',exact:true}).check();await dialog.getByRole('checkbox',{name:'運送事業許可情報',exact:true}).check();
  await dialog.getByRole('button',{name:'仮提出（デモ）',exact:true}).click();await expect(dialog).toContainText('提出済');
  await page.getByRole('button',{name:'書類確認を閉じる',exact:true}).click();await expect(page.locator('.review-document-list')).toContainText('提出済');
  await page.reload();await page.getByRole('tab',{name:/不足書類/}).click();await page.getByRole('combobox',{name:'表示する書類',exact:true}).selectOption('許可情報');await expect(page.locator('.review-document-list')).toContainText('提出済');await expect(page.locator('.review-document-company')).toHaveCount(1);
});
test('dispatch cancel requires a second confirmation and keeps a record',async({page})=>{
  await page.goto(`${entry}&page=dispatch`);
  const row=page.getByRole('row').filter({hasText:'TR-20260820-03'});await row.getByRole('button',{name:'詳細・操作',exact:true}).click();
  await page.getByRole('tab',{name:'取消',exact:true}).click();await page.getByLabel('変更・取消理由',{exact:true}).fill('検証のため取消');
  await page.getByRole('button',{name:'取消をデモ内に反映',exact:true}).click();await expect(row).not.toContainText('取消');
  await page.getByRole('button',{name:'この便の取消を確定する（デモ）',exact:true}).click();await expect(row).toContainText('取消');
  await row.getByRole('button',{name:'詳細・操作',exact:true}).click();await page.getByRole('tab',{name:'履歴',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('検証のため取消');
});

test('retained labor and relationship submenus render distinct content',async({page})=>{
  await page.goto(`${entry}&page=labor`);
  await choose(page,'元請帳票の確認',1280);await expect(page.locator('.gf-page')).toContainText('元請帳票の確認');
  await choose(page,'配下協力会社検索',1280);await expect(page.getByRole('heading',{name:'配下協力会社検索',exact:true})).toBeVisible();
  await expect(page.locator('main .service-menu').getByRole('button',{name:'ドライバー検索',exact:true})).toHaveCount(0);
  await module(page,'基本台帳',1280);await choose(page,'ドライバー検索',1280);await expect(page.locator('.driver-search-page')).toBeVisible();
  await module(page,'関係会社',1280);await choose(page,'登録申請',1280);await expect(page.getByRole('heading',{name:'協力会社の招待・現場参加',exact:true})).toBeVisible();
  await choose(page,'元請会社',1280);await expect(page.getByRole('heading',{name:'元請会社一覧',exact:true})).toBeVisible();
});
