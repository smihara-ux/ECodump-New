import {chromium,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const credentials=JSON.parse(await readFile(new URL('../server/.local/credentials.json',import.meta.url)));
const account=credentials.accounts.find(a=>a.name==='narita-construction');
const out=new URL('../../docs/narita-validation/construction-ui/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch();const evidence=[];
async function inspect(page,label){const layout=await page.evaluate(()=>({viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,emptyButtons:[...document.querySelectorAll('button')].filter(x=>x.offsetParent&&!(x.textContent||x.getAttribute('aria-label')||'').trim()).length}));evidence.push({label,...layout});await page.screenshot({path:fileURLToPath(new URL(`${label}.png`,out)),fullPage:true});expect(layout.overflow).toBe(false);expect(layout.emptyButtons).toBe(0);}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4178/?preview=app&role=construction&page=transport');await page.getByRole('button',{name:'ログインして保存を利用'}).click();await page.getByLabel('メールアドレス',{exact:true}).fill(account.email);await page.getByLabel('パスワード',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'ログイン',exact:true}).click();await expect(page.getByText(/共通データを利用/)).toBeVisible();await expect(page.getByText(/共通データで表示中/)).toBeVisible();await expect(page.getByRole('table')).toBeVisible();await inspect(page,'transport-pc');
 await page.setViewportSize({width:820,height:1180});await inspect(page,'transport-tablet');await page.goto('http://127.0.0.1:4178/?preview=app&role=construction&page=fields');await expect(page.getByRole('heading',{name:'担当現場'})).toBeVisible();await expect(page.getByText('成田空港モデル現場A工区',{exact:true}).first()).toBeVisible();await expect(page.getByText('成田空港モデル現場B工区',{exact:true}).first()).toBeVisible();await expect(page.getByText('栃木モデル採石場〈架空〉',{exact:true})).toHaveCount(0);await inspect(page,'sites-tablet');
 expect(errors).toEqual([]);await writeFile(new URL('evidence.json',out),JSON.stringify({checkedAt:new Date().toISOString(),environment:'local isolated PostgreSQL',evidence,errors},null,2));console.log(JSON.stringify({evidence,errors}));
}finally{await browser.close();}
