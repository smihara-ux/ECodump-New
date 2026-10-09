import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const entry='/?preview=app&role=construction&demo=1&navigationReview=1';
const evidence=process.env.ECODUMP_FIELD_AUDIT_DIR || '../tmp/field-review-2026-10-09';
test.use({ locale:'ja-JP', reducedMotion:'reduce' });

for (const theme of ['dark','light']) for (const width of [390,768,1440,1920]) {
  test(`company table has readable columns ${theme} ${width}`, async ({page}) => {
    await page.setViewportSize({width,height:1000});
    await page.addInitScript(t=>localStorage.setItem('ecodump-theme',t),theme);
    for (const route of ['agencies','prime-contractors']) {
      await page.goto(`${entry}&page=${route}`);
      const table=page.locator('.review-relations-table');
      await expect(table).toBeVisible();
      const rows=await table.locator('tbody tr').evaluateAll(es=>es.map(e=>{
        const r=e.getBoundingClientRect();
        return {height:r.height,bottom:r.bottom,cells:[...e.querySelectorAll('td')].map(c=>{
          const b=c.getBoundingClientRect();return {width:b.width,bottom:b.bottom,left:b.left,right:b.right,display:getComputedStyle(c).display,background:getComputedStyle(c).backgroundColor};
        })};
      }));
      for(const row of rows){
        expect(row.cells[0].width).toBeGreaterThan(150);
        for(const cell of row.cells){expect(cell.bottom).toBeLessThanOrEqual(row.bottom+2);expect(cell.background).toBe('rgba(0, 0, 0, 0)');}
        if(row.cells[0].display==='table-cell') for(let i=1;i<row.cells.length;i++) expect(row.cells[i].left).toBeGreaterThanOrEqual(row.cells[i-1].right-1);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
      await page.getByRole('button',{name:'詳細',exact:true}).first().click();
      await expect(page.locator('.review-company-detail')).toBeVisible();
      await page.getByRole('button',{name:'会社一覧へ戻る',exact:true}).click();
      mkdirSync(evidence,{recursive:true});
      await page.screenshot({path:`${evidence}/relations-${route}-${theme}-${width}.png`});
    }
  });
  test(`site reference table and inline details ${theme} ${width}`, async ({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.addInitScript(t=>localStorage.setItem('ecodump-theme',t),theme);
    await page.goto(`${entry}&page=transport`);
    const table=page.locator('.review-site-table');
    const rows=table.locator('.review-site-row');
    await expect(rows).toHaveCount(23);
    await expect(table.locator('th')).toHaveText(['元請名','支店名','現場名','住所','着工日','竣工日','ステータス']);
    const first=rows.first();
    await expect(first).toContainText('32182');
    const layout=await rows.evaluateAll(es=>es.map(e=>{
      const r=e.getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,cells:[...e.children].map(c=>{
        const b=c.getBoundingClientRect();return {left:b.left,right:b.right,bottom:b.bottom,display:getComputedStyle(c).display};
      })};
    }));
    for(let n=0;n<layout.length;n++){
      const row=layout[n];if(n)expect(row.top).toBeGreaterThanOrEqual(layout[n-1].bottom-1);
      for(const cell of row.cells)expect(cell.bottom).toBeLessThanOrEqual(row.bottom+1);
      if(row.cells[0].display==='table-cell')for(let i=1;i<row.cells.length;i++)expect(row.cells[i].left).toBeGreaterThanOrEqual(row.cells[i-1].right-1);
    }
    await table.locator('[data-field-id="32184"]').getByRole('button',{name:'現場詳細を開く',exact:true}).click();
    await expect(page.locator('.review-site-inline-detail')).toHaveCount(1);
    await expect(page.locator('.review-site-inline-detail')).toContainText('現場ID：32184');
    await expect(page.locator('.review-site-inline-detail .review-site-empty')).toHaveCount(0);
    await page.getByRole('combobox',{name:'現場の詳細項目',exact:true}).selectOption('搬出予定');
    await expect(page.locator('.review-site-inline-detail .review-site-empty')).toBeVisible();
    await page.getByRole('button',{name:'詳細を閉じる',exact:true}).click();
    await first.getByRole('button',{name:'現場詳細を開く',exact:true}).click();
    await expect(page.locator('.review-site-inline-detail .trip-row:not(.trip-head)')).toHaveCount(0);
    await page.getByRole('button',{name:'この現場の搬出予定を見る',exact:true}).click();
    await expect(page.locator('.review-site-inline-detail .trip-row:not(.trip-head)')).toHaveCount(3);
    const panelBounds=await page.locator('.review-site-inline-detail').evaluate(e=>{
      const panel=e.getBoundingClientRect(), scroll=e.closest('.review-site-table-scroll').getBoundingClientRect();
      return {left:panel.left,right:panel.right,scrollLeft:scroll.left,scrollRight:scroll.right};
    });
    expect(panelBounds.left).toBeGreaterThanOrEqual(panelBounds.scrollLeft);
    expect(panelBounds.right).toBeLessThanOrEqual(panelBounds.scrollRight);
    await page.reload();
    await expect(first.getByRole('button',{name:'詳細を閉じる',exact:true})).toHaveAttribute('aria-expanded','true');
    const selector=page.getByRole('combobox',{name:'現場の詳細項目',exact:true});
    await expect(selector).toBeVisible();
    await expect(page.locator('.review-field-context > details')).toHaveCount(0);
    for(const item of ['概要','搬出条件','搬出予定','車両・運転手','運行状況','搬出入記録・写真・伝票','数量実績','書類','協力会社']) {
      await selector.selectOption(item);
      await expect(selector).toHaveValue(item);
      if(item==='搬出条件') {
        const metrics=await page.locator('.construction-field-panel .field-kpis > article').evaluateAll(es=>es.map(e=>({
          labelBottom:e.querySelector('span').getBoundingClientRect().bottom,
          valueTop:e.querySelector('b').getBoundingClientRect().top,
        })));
        expect(metrics).toHaveLength(4);
        for(const metric of metrics) expect(metric.valueTop).toBeGreaterThan(metric.labelBottom);
      }
    }
    await selector.selectOption('概要');
    await selector.scrollIntoViewIfNeeded();
    mkdirSync(evidence,{recursive:true});
    await page.screenshot({path:`${evidence}/sites-expanded-${theme}-${width}.png`});
    await page.getByRole('button',{name:'詳細を閉じる',exact:true}).click();
    await page.getByRole('combobox',{name:'現場',exact:true}).selectOption('成田空港モデル現場 B工区');
    await expect(rows).toHaveCount(1);
    await expect(page.locator('.review-site-inline-detail')).toContainText('成田空港モデル現場 B工区');
    await expect(page.locator('.review-site-inline-detail')).not.toContainText('成田空港モデル現場 A工区');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
    await page.getByRole('combobox',{name:'現場',exact:true}).selectOption('すべて');
    await page.getByRole('button',{name:'詳細を閉じる',exact:true}).click();
    await page.getByRole('button',{name:'受入場所別',exact:true}).click();
    await expect(page.locator('.construction-trip-group')).toHaveCount(2);
    await expect(page.locator('.construction-trip-list .trip-row:not(.trip-head)')).toHaveCount(6);
    await page.getByRole('button',{name:'現場別',exact:true}).click();
    await expect(rows).toHaveCount(23);
    await first.scrollIntoViewIfNeeded();
    mkdirSync(evidence,{recursive:true});
    await page.screenshot({path:`${evidence}/sites-${theme}-${width}.png`});
  });
  if(width>1100)test(`original field table columns stay aligned ${theme} ${width}`, async ({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.addInitScript(t=>localStorage.setItem('ecodump-theme',t),theme);
    await page.goto(`/?preview=app&role=construction&page=fields&demo=1`);
    const table=page.locator('.field-list-transport-only');
    await expect(table.locator('th')).toHaveText(['元請名','支店名','現場名','住所','着工日','竣工日','ステータス']);
    const cells=await table.locator('tbody tr').first().locator('td').evaluateAll(es=>es.map(e=>{
      const b=e.getBoundingClientRect();return {left:b.left,right:b.right,position:getComputedStyle(e).position};
    }));
    expect(cells).toHaveLength(7);
    for(let i=1;i<cells.length;i++)expect(cells[i].left).toBeGreaterThanOrEqual(cells[i-1].right-1);
    expect(cells[0].position).toBe('static');
    const scroll=page.locator('.table-scroll');
    await scroll.evaluate(e=>e.scrollLeft=180);
    const shifted=await table.locator('tbody tr').first().locator('td').evaluateAll(es=>es.map(e=>{
      const b=e.getBoundingClientRect();return {left:b.left,right:b.right};
    }));
    for(let i=1;i<shifted.length;i++)expect(shifted[i].left).toBeGreaterThanOrEqual(shifted[i-1].right-1);
    await scroll.evaluate(e=>e.scrollLeft=0);
    await page.screenshot({path:`${evidence}/original-sites-${theme}-${width}.png`});
  });
}
