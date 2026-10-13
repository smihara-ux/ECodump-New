import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Route the public hostname to local build files. No deployment or real writes.
const root = fileURLToPath(new URL("../dist/client/", import.meta.url));
const origin = "https://smihara-ux.github.io", prefix = "/ECodump-New/";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://local").pathname;
  const file = resolve(root, decodeURIComponent(path.slice(prefix.length)) || "index.html");
  if (request.method !== "GET" || !path.startsWith(prefix) || !file.startsWith(resolve(root) + sep)) { response.writeHead(404); response.end(); return; }
  try { response.setHeader("content-type", types[extname(file)] || "application/octet-stream"); response.end(await readFile(file)); }
  catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const local = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = [];
try {
  for (const theme of ["light", "dark"]) for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    await context.addInitScript(theme => localStorage.setItem("ecodump-theme", theme), theme);
    const errors = [], writes = [], missing = [];
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== origin || request.method() !== "GET" || url.pathname.includes("/api/")) {
        writes.push(request.url()); await route.abort(); return;
      }
      const response = await context.request.get(local + url.pathname);
      if (!response.ok()) missing.push(url.pathname);
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}${prefix}?entry=1`);
    await page.getByText("デモで試す", { exact: true }).click();
    await page.getByRole("button", { name: "施工側としてデモログイン →", exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get("role"), "construction");
    assert.equal(new URL(page.url()).searchParams.get("navigationReview"), "1");
    await page.getByRole("button", { name: "予定を作る", exact: true }).click();
    await page.locator(".daily-plan-form").waitFor();
    await page.goto(`${origin}${prefix}?entry=1`);
    await page.getByText("デモで試す", { exact: true }).click();
    await page.getByRole("button", { name: "マッチング成立の流れを試す →", exact: true }).click();
    assert.ok(page.url().startsWith(origin + prefix));
    await page.getByRole("button", { name: "この搬出条件で候補を確認（デモ）", exact: true }).click();
    await page.getByRole("button", { name: "事前相談を開始（デモ）", exact: true }).click();
    async function review(actor) {
      await page.getByRole("button", { name: "資料・条件の確認へ", exact: true }).click();
      await page.getByRole("button", { name: "サンプル資料を開く", exact: true }).click();
      await page.getByLabel("この版のサンプル資料を確認しました", { exact: true }).check();
      await page.getByRole("button", { name: "資料の確認を記録（デモ）", exact: true }).click();
      await page.getByLabel("第1版の条件を確認し、合意します（デモ）", { exact: true }).check();
      await page.getByRole("button", { name: `${actor}として条件に合意（デモ）`, exact: true }).click();
    }
    await review("施工側");
    assert.equal(await page.getByRole("heading", { name: "マッチング成立（デモ）", exact: true }).count(), 0);
    await page.locator(".journey-role-bar").getByRole("button", { name: "受入側の確認画面へ（デモ）", exact: true }).click();
    await page.locator(".role-receiving").waitFor();
    await review("受入側");
    await page.getByRole("heading", { name: "マッチング成立（デモ）", exact: true }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: "成立内容を確認", exact: true }).click();
    assert.match(await page.locator(".journey-agreed").innerText(), /MDEMO-EXPORT-001/);
    assert.match(await page.locator(".journey-after").innerText(), /未申請/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 2));
    await page.locator(".journey-role-bar").getByRole("button", { name: "施工側の確認画面へ（デモ）", exact: true }).click();
    await page.getByRole("heading", { name: "マッチング成立（デモ）", exact: true }).waitFor();
    assert.ok(page.url().startsWith(origin + prefix));
    await page.getByRole("button", { name: "合意済み案件から予定を作る", exact: true }).click();
    await page.getByRole("form", { name: "合意済み案件の予定作成", exact: true }).waitFor();
    await page.getByRole("button", { name: "予定を作成して予約申請（デモ）", exact: true }).click();
    const planned = await page.evaluate(() => JSON.parse(localStorage.getItem("ecodump-narita-preview-v1")).trips.filter(trip => trip.matchAgreementId));
    assert.equal(planned.length, 2);
    assert.equal(planned[0].reservationId, planned[1].reservationId);
    assert.ok(planned.every(trip => trip.material === "第2種建設発生土" && trip.reservation === "申請中" && !trip.vehicleId));
    await page.locator("tbody tr").filter({ hasText: planned[0].id }).getByRole("button", { name: "詳細・操作", exact: true }).click();
    await page.getByRole("button", { name: "受入側でこの予約を確認", exact: true }).click();
    assert.ok(page.url().startsWith(origin + prefix));
    for (const [index, trip] of planned.entries()) {
      if (index) await page.goto(`${origin}${prefix}?preview=app&role=receiving&page=receiving-reservations&demo=1&matchingDemo=1&matchTrip=${trip.id}`);
      await page.getByRole("button", { name: "予約を承認（試作）", exact: true }).click();
      assert.match(await page.locator(".receiving-detail").innerText(), /予約確定/);
    }
    await page.getByRole("button", { name: "この案件の成立内容へ戻る", exact: true }).click();
    await page.getByRole("heading", { name: "マッチング成立（デモ）", exact: true }).waitFor();
    assert.match(await page.locator(".journey-after").innerText(), /承認済み 2便/);
    await page.locator(".journey-role-bar").getByRole("button", { name: "施工側の確認画面へ（デモ）", exact: true }).click();
    await page.getByRole("button", { name: "通常の候補画面へ", exact: true }).click();
    await page.getByRole("button", { name: "新しい案件を登録", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    assert.deepEqual(missing, []);
    results.push({ theme, width, entry: true, constructionLogin: true, directPlanForm: true, bothRoles: true, agreement: true, sharedReservation: true, receivingApproval: true, reload: true, originalScreen: true, apiWrites: 0 });
    await context.close();
  }
  console.log(JSON.stringify({ staticPagesDemo: "local build only", passed: results.length, results }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
