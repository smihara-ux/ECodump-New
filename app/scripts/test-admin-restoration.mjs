import {chromium,expect} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const base='http://127.0.0.1:5199',credentials=JSON.parse(await readFile(new URL('../server/.local/credentials.json',import.meta.url))),out=new URL('../../docs/admin-restoration-qa/',import.meta.url);
const browser=await chromium.launch(),evidence=[],errors=[];
async function login(p,role){await p.getByRole('button',{name:'ログインして保存を利用',exact:true}).click();const d=p.getByRole('dialog');await d.getByLabel('メールアドレス').fill(`${role==='receiving'?'receiver':role}@sample.invalid`);await d.getByLabel('パスワード',{exact:true}).fill(credentials.password);await d.getByRole('button',{name:'ログイン',exact:true}).click();await expect(d).toHaveCount(0);}
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`${base}/?preview=app&role=receiving&page=transport`);
 await expect(p.getByText('旧SQLite検証',{exact:false})).toHaveCount(0);await expect(p.getByRole('button',{name:'受入場所別',exact:true})).toHaveAttribute('aria-pressed','true');
 const nav=n=>p.locator('.sidebar').getByRole('button',{name:n,exact:true});
 await nav('運行ダッシュボード').click();await expect(p.getByRole('button',{name:'配車を組む',exact:true})).toHaveCount(0);await expect(p.locator('.operations-map')).toHaveCount(1);await p.screenshot({path:fileURLToPath(new URL('dashboard.png',out))});
 await nav('受入管理').click();await p.screenshot({path:fileURLToPath(new URL('home-preview.png',out))});
 await nav('取引先・基本設定').click();for(const n of ['会社情報','ユーザー一覧','車両一覧','代行先一覧','代行登録申請','自社の代行元一覧','入退場管理'])await expect(p.locator('.receiving-actions').getByRole('button',{name:n,exact:true})).toBeVisible();
 await nav('発生土マッチ').click();await expect(p.getByRole('heading',{name:'検証ユーザーで接続'})).toHaveCount(0);await expect(p.getByRole('button',{name:'現場から探す',exact:true})).toBeVisible();await p.screenshot({path:fileURLToPath(new URL('matching-preview.png',out))});
 await login(p,'receiving');await expect(p.getByRole('navigation',{name:'発生土マッチの区分'})).toBeVisible();await expect(p.locator('.matching-kpis')).toContainText('自社の案件');
 await p.getByRole('button',{name:'自社の案件',exact:true}).click();const title=`受入条件・通常画面試験 ${Date.now()}`;await p.getByLabel('案件名',{exact:true}).fill(title);await p.getByLabel('地域',{exact:true}).fill('匿名地域');await p.getByRole('button',{name:'下書き保存',exact:true}).click();await expect(p.locator('.matching-live-notice')).toContainText('下書き');await p.reload();await p.getByRole('button',{name:'自社の案件',exact:true}).click();await expect(p.getByText(title,{exact:true})).toBeVisible();evidence.push({scenario:'通常画面でマッチ下書き保存・再読込',title,result:'PASS'});
 await p.screenshot({path:fileURLToPath(new URL('matching-saved.png',out))});
 await nav('受入管理').click();await expect(p.getByRole('button',{name:'受入場所別',exact:true})).toHaveAttribute('aria-pressed','true');await expect(p.getByText('保存済みの予約・実績')).toBeVisible();await p.screenshot({path:fileURLToPath(new URL('home-saved.png',out))});
 await nav('搬入予約・受付').click();await expect(p.locator('.business-connected')).toBeVisible();await expect(p.locator('.connected-admin')).toHaveCount(0);await expect(p.getByText('旧SQLite検証',{exact:false})).toHaveCount(0);
 evidence.push({scenario:'受入ホーム・予約・マッチを既存シェル内で共通API接続',result:'PASS'});
 await nav('実績・帳票').click();await expect(p.locator('.connected-heading h1')).toHaveText('受入実績');
 await p.locator('.business-session-bar').getByRole('button',{name:'ログアウト',exact:true}).click();await expect(p.getByRole('button',{name:'ログインして保存を利用',exact:true})).toBeVisible();await login(p,'receiving');await expect(p.locator('.business-connected')).toBeVisible();
 for(const [w,h] of [[820,1180],[390,844]]){await p.setViewportSize({width:w,height:h});await p.goto(`${base}/?preview=app&role=receiving&page=transport`);if(w<761)await p.locator('.mobile-menu').click();else await p.locator('.sidebar .collapse').click();await nav('運行ダッシュボード').click();await expect(p).toHaveURL(/page=control/);await expect(p.getByRole('button',{name:'配車を組む',exact:true})).toHaveCount(0);await p.screenshot({path:fileURLToPath(new URL(`dashboard-${w}.png`,out))});}
 evidence.push({scenario:'PC・タブレット・スマートフォンのメニュー移動',result:'PASS'});expect(errors).toEqual([]);await writeFile(new URL('evidence.json',out),JSON.stringify({evidence,errors},null,2));console.log(JSON.stringify({evidence,errors},null,2));
}catch(e){for(const p of browser.contexts().flatMap(c=>c.pages())){console.log((await p.locator('body').innerText()).slice(-5000));await p.screenshot({path:fileURLToPath(new URL('failure.png',out))});}throw e;}finally{await browser.close();}
