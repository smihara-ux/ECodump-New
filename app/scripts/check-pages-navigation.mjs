import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Exercise the built /ECodump-New/ assets with the actual public hostname.
// Only static files are served; no public network mutation or API is involved.
const root = resolve(fileURLToPath(new URL("../dist/client/", import.meta.url)));
const prefix = "/ECodump-New/";
const origin = "https://smihara-ux.github.io";
const evidence = process.env.ECODUMP_PAGES_AUDIT_DIR;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://local").pathname;
  if (req.method !== "GET" || !path.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
  const file = resolve(root, decodeURIComponent(path.slice(prefix.length)) || "index.html");
  if (!file.startsWith(root + sep)) { res.writeHead(404); res.end(); return; }
  try { res.setHeader("content-type", types[extname(file)] || "application/octet-stream"); res.end(await readFile(file)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const local = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = [];
const entry = `${origin}${prefix}?preview=app&role=construction&demo=1&navigationReview=1`;
try {
  for (const theme of ["dark", "light"]) for (const width of [390, 1440]) {
    const context = await browser.newContext({viewport: {width, height: width === 390 ? 844 : 1000}, reducedMotion:"reduce"});
    await context.addInitScript(t => localStorage.setItem("ecodump-theme", t), theme);
    const errors = [], api = [], missing = [];
    await context.route(`${origin}/**`, async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() !== "GET" || path.includes("/api/")) { api.push(request.url()); await route.abort(); return; }
      const response = await context.request.get(local + path);
      if (!response.ok()) missing.push(path);
      await route.fulfill({response});
    });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(entry + "&page=transport");
    await page.locator(".navigation-review").waitFor();
    assert.equal(await page.locator(".review-site-row").count(), 23);
    async function module(name) {
      if (width === 390) await page.locator(".mobile-menu").click();
      await page.locator(".sidebar").getByRole("button", {name, exact:true}).click();
      if (width === 390 && await page.locator(".mobile-menu").getAttribute("aria-expanded") === "true") await page.locator(".mobile-menu").click();
    }
    for (const name of ["施工管理", "運行管理", "労務安全", "実績管理", "基本台帳", "関係会社"]) {
      await module(name);
      await page.locator(".navigation-review-main").waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 2), `${name}: horizontal overflow`);
      await page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
      if (name === "関係会社") {
        const layout = await page.locator(".review-relations-table").evaluate(e => {
          const row=e.querySelector("tbody tr"), cell=row.querySelector("td"), bounds=e.getBoundingClientRect();
          return {display:getComputedStyle(row).display, width:row.getBoundingClientRect().width, available:bounds.width, cell:cell.getBoundingClientRect().width, height:row.getBoundingClientRect().height, bottom:row.getBoundingClientRect().bottom, cellBottom:Math.max(...[...row.querySelectorAll("td")].map(c=>c.getBoundingClientRect().bottom))};
        });
        assert.ok(layout.width <= layout.available + 2, "relation row must fit its work area");
        assert.equal(layout.display, width === 390 ? "grid" : "table-row");
        assert.ok(layout.cellBottom <= layout.bottom + 2, "relation cells must fit their row without overlap");
        if (width === 390) assert.ok(layout.height >= 180, "mobile card must grow with its contents");
        assert.ok(layout.cell >= (width === 390 ? 240 : 160), "company names need a readable column");
      }
      if (evidence) { await mkdir(evidence, {recursive:true}); await page.screenshot({path:resolve(evidence, `${theme}-${width}-${name}.png`)}); }
      results.push({theme,width,module:name,passed:true});
    }
    await page.getByRole("button", {name:"詳細",exact:true}).last().click();
    assert.match(page.url(), /reviewCompany=NC-03/);
    await page.getByRole("tab", {name:/不足書類/}).click();
    assert.equal(await page.locator(".review-document-company").count(),1);
    await page.getByRole("combobox", {name:"表示する書類",exact:true}).selectOption("許可情報");
    assert.equal(await page.locator(".review-document-row h4").textContent(), "許可情報");
    await page.getByRole("button", {name:"労務安全で詳しく確認",exact:true}).click();
    assert.match(page.url(), /page=labor/);
    assert.equal(await page.getByRole("combobox", {name:"表示する書類",exact:true}).inputValue(), "許可情報");
    await page.getByRole("button", {name:"会社詳細へ戻る",exact:true}).click();
    assert.equal(await page.locator(".review-company-detail").count(),1);
    assert.deepEqual(errors, []);
    assert.deepEqual(api, []);
    assert.deepEqual(missing, []);
    await context.close();
  }
  // A third party starts without cookies or storage, through the public login entry.
  for (const width of [390, 1440]) for (const flow of ["shortcut", "credentials", "registration"]) for (const [role, label] of [["construction", "施工側"], ["receiving", "受入側"], ["driver", "ドライバー"]]) {
    const context = await browser.newContext({viewport:{width,height:width === 390 ? 844 : 1000}});
    const errors = [], api = [], missing = [];
    await context.route(`${origin}/**`, async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() !== "GET" || path.includes("/api/")) { api.push(request.url()); await route.abort(); return; }
      const response = await context.request.get(local + path);
      if (!response.ok()) missing.push(path);
      await route.fulfill({response});
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}${prefix}${flow === "shortcut" ? "" : "?entry=1&v=20261009-share"}`);
    await page.locator(".demo-entry").waitFor();
    assert.equal(await page.locator(".entry-demo-options").getAttribute("open"), null, "preserve the collapsed demo entry design");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 2), "entry must fit its viewport");
    await page.waitForFunction(() => [...document.querySelectorAll(".demo-entry img")].every(img => img.complete && img.naturalWidth > 0));
    if (flow === "shortcut") {
      await page.getByText("デモで試す", {exact:true}).click();
      if (role === "construction" && evidence) {
        await mkdir(evidence, {recursive:true});
        await page.screenshot({path:resolve(evidence, `login-demo-${width}.png`),fullPage:true});
      }
      await page.getByRole("button", {name:`${label}としてデモログイン →`,exact:true}).click();
    } else if (flow === "credentials") {
      await page.getByLabel("メールアドレス", {exact:true}).fill(`${role}@sample.invalid`);
      await page.getByLabel("パスワード", {exact:true}).fill("demo-only");
      await page.locator("form").getByRole("button", {name:"ログイン",exact:true}).click();
    } else {
      await page.getByRole("button", {name:"新規会員登録",exact:true}).click();
      await page.getByRole("combobox", {name:/^利用区分/}).selectOption(role);
      await page.getByLabel("会社名", {exact:true}).fill("共有確認用サンプル会社");
      await page.getByLabel("お名前", {exact:true}).fill("サンプル担当者");
      await page.getByLabel("メールアドレス", {exact:true}).fill("share-check@sample.invalid");
      await page.getByLabel("パスワード", {exact:true}).fill("demo-only");
      await page.getByRole("button", {name:"登録内容を確認する",exact:true}).click();
      await page.getByText("デモのため、アカウント作成・確認メール送信は行っていません。", {exact:true}).waitFor();
      await page.getByRole("button", {name:`${label}の画面を試す`,exact:true}).click();
    }
    await page.locator(role === "driver" ? ".driver-app" : ".app-shell").waitFor();
    assert.equal(await page.locator(".navigation-review").count(), role === "construction" ? 1 : 0);
    if (role === "construction") assert.equal(await page.locator(".review-site-row").count(),23);
    if (role === "receiving") assert.equal(await page.locator(".role-receiving").count(),1);
    await page.getByRole("link", {name:"ログイン画面に戻る",exact:true}).click();
    await page.locator(".demo-entry").waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual(api, []);
    assert.deepEqual(missing, []);
    results.push({role,width,entryFlow:flow,anonymous:true,passed:true});
    await context.close();
  }
  const context = await browser.newContext();
  await context.route(`${origin}/**`, async route => {
    await route.fulfill({response:await context.request.get(local + new URL(route.request().url()).pathname)});
  });
  const page = await context.newPage();
  await page.goto(`${origin}${prefix}review.html`);
  const guide = await page.getByRole("link", {name:"施工側を操作する",exact:true}).getAttribute("href");
  assert.match(guide, /navigationReview=1/);
  await page.getByRole("link", {name:"施工側を操作する",exact:true}).click();
  await page.locator(".navigation-review").waitFor();
  for (const [role, query] of [["construction","page=company"],["receiving","page=transport&navigationReview=1"],["driver","app=driver&navigationReview=1"]]) {
    await page.goto(`${origin}${prefix}?preview=app&role=${role}&${query}`);
    await page.locator(role === "driver" ? ".driver-app" : ".app-shell").waitFor();
    assert.equal(await page.locator(".navigation-review").count(),0);
    results.push({role,regular:true,passed:true});
  }
  await context.close();
  console.log(JSON.stringify({scope:"built static public-host simulation",states:results.length,results},null,2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
