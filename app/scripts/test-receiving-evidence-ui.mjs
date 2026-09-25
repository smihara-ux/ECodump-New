import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
const fixture=JSON.parse(await readFile('../docs/receiving-evidence-qa/fixture.json')),creds=JSON.parse(await readFile('server/.local/credentials.json'));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5199/?preview=app&role=receiving&page=transport');
 await page.getByRole('button',{name:'サンプル搬出現場 A',exact:true}).click();
 await page.getByRole('button',{name:'入退場・写真',exact:true}).click();assert.ok(await page.getByText('カメラ未接続 · 到着・荷下ろし報告から入退場時刻を自動確定しません。').isVisible());
 await page.getByRole('button',{name:'詳細を閉じる'}).click();
 await page.getByRole('button',{name:'本日の予定の明細'}).scrollIntoViewIfNeeded();await page.screenshot({path:'../docs/receiving-evidence-qa/home-preview.png',fullPage:true});
 await page.getByRole('button',{name:'ログインして保存を利用'}).click();await page.getByLabel('パスワード',{exact:true}).fill(creds.password);await page.getByRole('button',{name:'ログイン',exact:true}).click();
 await page.getByLabel('表示日',{exact:true}).fill(fixture.day);
 await page.getByLabel('現場・受入場所・車両を検索',{exact:true}).fill('サンプル');
 await page.getByRole('region',{name:'搬出元現場別の予定・実績'}).getByRole('button',{name:/現場/,exact:false}).first().click();
 await page.getByRole('button',{name:'入退場・写真',exact:true}).click();assert.ok(await page.getByText('滞在時間：50分',{exact:true}).isVisible());
 await page.getByRole('button',{name:'伝票・数量',exact:true}).click();await page.getByAltText('原本写真：anonymous-original.png').waitFor();
 await page.getByRole('checkbox',{name:'原本写真と数量・単位を照合しました'}).check();
 await page.getByLabel('差異・訂正理由').fill('画面検証：原票6.700tと一致することを再確認');
 await page.getByRole('button',{name:'理由付きで訂正を保存'}).click();await page.getByRole('dialog').getByText('保存後の記録を再取得しました。',{exact:true}).waitFor();
 await page.screenshot({path:'../docs/receiving-evidence-qa/receipt-pc.png',fullPage:true});
 await page.getByRole('button',{name:'詳細を閉じる'}).click();assert.equal(await page.getByLabel('表示日',{exact:true}).inputValue(),fixture.day);assert.equal(await page.getByLabel('現場・受入場所・車両を検索',{exact:true}).inputValue(),'サンプル');
 await page.reload();await page.getByLabel('表示日',{exact:true}).fill(fixture.day);await page.getByRole('button',{name:'原票確認済み 6.700',exact:true}).click();
 await page.getByRole('button',{name:'伝票・数量',exact:true}).click();await page.getByText('理由：画面検証：原票6.700tと一致することを再確認',{exact:true}).waitFor();
 await page.getByRole('button',{name:'詳細を閉じる'}).click();await page.screenshot({path:'../docs/receiving-evidence-qa/home-pc.png',fullPage:true});
 await page.setViewportSize({width:820,height:1180});await page.getByRole('button',{name:'原票確認済み 6.700',exact:true}).click();await page.getByRole('button',{name:'伝票・数量',exact:true}).click();await page.getByAltText('原本写真：anonymous-original.png').waitFor();await page.screenshot({path:'../docs/receiving-evidence-qa/receipt-tablet.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'詳細を閉じる'}).click();await page.getByRole('button',{name:'ダークモードに切り替え'}).click();await page.getByRole('button',{name:'原票確認済み 6.700',exact:true}).click();await page.screenshot({path:'../docs/receiving-evidence-qa/detail-tablet-dark.png',fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 assert.deepEqual(errors,[]);await writeFile('../docs/receiving-evidence-qa/ui.json',JSON.stringify({passed:true,widths:[1440,820],checks:['sample site panel','camera unavailable','live scoped home','gate duration50min','original image','correction saved','date and search retained','reload persisted correction','unit specific drilldown','tablet panel fits','Escape closes'],errors},null,2));
 console.log('PASS: PC/tablet receiving home, original review, DB correction, reload and retained filters');
}finally{await browser.close();}
