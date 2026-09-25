import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out=new URL('../../docs/receiving-sidebar-qa/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch();const evidence=[];
for(const [label,width,height] of [['pc',1440,1000],['tablet',820,1180],['phone',390,844],['small-phone',360,800]]){
 const page=await browser.newPage({viewport:{width,height}});
 await page.goto('http://127.0.0.1:5199/?preview=app&role=receiving&page=transport');
 await expect(page.getByRole('button',{name:'受入場所別',exact:true})).toHaveAttribute('aria-pressed','true');
 const sidebar=page.locator('.sidebar'),nav=page.getByRole('navigation',{name:'受入側機能切替'});
 async function expand(){if(!await nav.isVisible()){if(width<=760)await page.locator('.mobile-menu').click();else await sidebar.getByRole('button',{name:'サイドバーを開く',exact:true}).click();}await expect(nav).toBeVisible();await expect.poll(async()=>Math.round((await sidebar.boundingBox()).width)).toBe(322);await expect.poll(async()=>Math.round((await sidebar.boundingBox()).x)).toBe(0);}
 await expand();
 await expect(sidebar.locator('.nav-group').getByRole('button',{name:'発生土マッチ'})).toHaveCount(0);
 await expect(sidebar.getByRole('button',{name:'労務安全',exact:true})).toHaveCount(0);
 const manage=nav.getByRole('button',{name:'受入側 管理'}),match=nav.getByRole('button',{name:'発生土マッチ'});
 await expect(manage).toHaveAttribute('aria-current','page');
 const layout=await nav.evaluate(n=>{const s=n.closest('.sidebar').getBoundingClientRect();return [...n.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {text:b.innerText,width:r.width,height:r.height,inside:r.left>=s.left&&r.right<=s.right,lines:[...b.querySelectorAll('span')].map(e=>({text:e.textContent,clipped:e.getBoundingClientRect().left<r.left+3||e.getBoundingClientRect().right>r.right-3}))}})});
 console.log(label,JSON.stringify(layout));
 expect(layout.every(x=>x.inside&&x.lines.every(l=>!l.clipped))).toBe(true);
 const strip=await page.locator('.sidebar-suite-strip').boundingBox(),collapse=await sidebar.locator('.collapse').boundingBox();expect(collapse.y).toBeGreaterThanOrEqual(strip.y+strip.height);
 await match.focus();await page.keyboard.press('Tab');await expect(manage).toBeFocused();const outline=await manage.evaluate(e=>getComputedStyle(e).outlineStyle);expect(outline).not.toBe('none');
 await manage.evaluate(e=>e.blur());await page.screenshot({animations:"disabled",path:fileURLToPath(new URL(`${label}.png`,out)),fullPage:true});
 await match.click();await expect(page).toHaveURL(/page=matching/);await expand();await expect(match).toHaveAttribute('aria-current','page');await expect(manage).not.toHaveAttribute('aria-current','page');
 await manage.click();await expect(page).toHaveURL(/page=transport/);await expand();await expect(manage).toHaveAttribute('aria-current','page');
 await sidebar.getByRole('button',{name:'受入場所管理',exact:true}).click();await expand();await expect(manage).toHaveAttribute('aria-current','page');
 await nav.getByRole('button',{name:/総合/}).click();await expect(page.getByText(/接続先は現在未実装/)).toBeVisible();await page.keyboard.press('Escape');
 await sidebar.getByRole('button',{name:'サイドバーを閉じる',exact:true}).click();await expect(nav).toHaveCount(0);await page.screenshot({path:fileURLToPath(new URL(`${label}-collapsed.png`,out)),fullPage:true});await expand();
 evidence.push({label,width,height,layout,focusOutline:outline,navigation:'PASS',collapse:'PASS',unimplementedDialog:'PASS'});await page.close();
}
await writeFile(new URL('evidence.json',out),JSON.stringify(evidence,null,2));await browser.close();console.log('PASS: 4 widths, placement, labels, focus, routes, selection, collapse and unimplemented destination');
