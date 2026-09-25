import {chromium,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const base=process.env.ECODUMP_PREVIEW_URL||'http://127.0.0.1:4178';
const credentials=JSON.parse(await readFile(new URL('../server/.local/credentials.json',import.meta.url)));
const evidence=JSON.parse(await readFile(new URL('../../docs/narita-validation/api-evidence.json',import.meta.url)));
const out=new URL('../../docs/narita-validation/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch();const consoleErrors=[];const results=[];
async function open({role,account,width,file}){
 const context=await browser.newContext({viewport:{width,height:980}}),page=await context.newPage();page.on('pageerror',error=>consoleErrors.push(`${role}: ${error.message}`));
 await page.goto(`${base}/?preview=app&role=${role}&page=transport&data=isolated`);
 const login=page.locator('.connected-login');const user=credentials.accounts.find(item=>item.name===account);
 await login.getByLabel('メールアドレス').fill(user.email);await login.getByLabel('検証用パスワード').fill(credentials.password);await login.getByRole('button',{name:'ログイン'}).click();
 await page.getByLabel('表示日（日本時間）').fill(evidence.day);await expect(page.locator('.connected-table-wrap, .trip-card').first()).toBeVisible();
 if(role==='construction'){await expect(page.locator('.connected-table-wrap')).toContainText('成田空港モデル現場A工区');await expect(page.locator('.connected-table-wrap')).toContainText('9.5 m³ 確定');}
 if(role==='receiving')await expect(page.locator('.connected-table-wrap')).toContainText('栃木モデル採石場');
 if(role==='driver')await expect(page.locator('.trip-card').first()).toContainText('検証車両01');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assertNoOverflow(overflow,role);
 await page.screenshot({path:fileURLToPath(new URL(file,out)),fullPage:true});results.push({role,account,width,file,overflow});await context.close();
}
function assertNoOverflow(value,role){if(value)throw new Error(`${role} has horizontal viewport overflow`);}
try{
 await open({role:'construction',account:'narita-construction',width:1440,file:'construction-pc.png'});
 await open({role:'receiving',account:'narita-receiver-tochigi',width:820,file:'receiving-tablet.png'});
 await open({role:'driver',account:'narita-driver-aoki',width:390,file:'driver-smartphone.png'});
 if(consoleErrors.length)throw new Error(consoleErrors.join('\n'));
 await writeFile(new URL('ui-evidence.json',out),JSON.stringify({checkedAt:new Date().toISOString(),base,day:evidence.day,results,consoleErrors},null,2));
 console.log('Narita validation UI PASS: separate construction/receiving/driver sessions');
}finally{await browser.close();}
