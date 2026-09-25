import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.ECODUMP_STAGING_URL || 'https://life-id.tailbe6181.ts.net:9462';
const credentials = JSON.parse(await readFile(new URL('../server/.local/dgx-staging/credentials.json', import.meta.url)));
const account = credentials.accounts.find((item) => item.name === 'narita-construction');
if (!account) throw new Error('Missing staging construction account');
const output = new URL('../../docs/narita-validation/construction-dgx-review/', import.meta.url);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  proxy: process.env.ECODUMP_STAGING_PROXY ? { server: process.env.ECODUMP_STAGING_PROXY } : undefined,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
const checks = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

async function open(route, name, expected) {
  await page.goto(`${base}/?preview=app&role=construction&page=${route}`, { waitUntil: 'networkidle' });
  await expect(page.getByText(expected, { exact: false }).first()).toBeVisible();
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    overflow: document.documentElement.scrollWidth > innerWidth,
    emptyButtons: [...document.querySelectorAll('button')].filter((button) => button.offsetParent && !(button.textContent || button.getAttribute('aria-label') || '').trim()).length,
  }));
  expect(metrics.overflow).toBe(false);
  expect(metrics.emptyButtons).toBe(0);
  checks.push({ name, route, ...metrics });
}

try {
  await page.goto(`${base}/?preview=app&role=construction&page=transport`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ログインして保存を利用' }).click();
  await page.getByLabel('メールアドレス', { exact: true }).fill(account.email);
  await page.getByLabel('パスワード', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page.getByText(/共通データを利用（検証環境）/)).toBeVisible();
  await page.getByLabel('表示日（日本時間）', { exact: true }).fill('2055-01-02');
  await expect(page.getByRole('row', { name: /成田空港モデル現場A工区/ }).first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: '施工側機能切替' })).toBeVisible();
  await expect(page.getByRole('button', { name: '発生土マッチ', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '施工側 管理', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation').last().getByText('発生土マッチ', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: fileURLToPath(new URL('construction-home-pc.png', output)), fullPage: true });
  await open('fields', '担当現場', '担当現場');
  await expect(page.getByText('成田空港モデル現場A工区', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('成田空港モデル現場B工区', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('栃木モデル採石場〈架空〉', { exact: true })).toHaveCount(0);
  await open('dispatch', '配車・運行管理', '配車・運行管理');
  await open('results', '実績・伝票', '実績');
  await open('matching', '発生土マッチ', '発生土マッチ');
  await expect(page.getByRole('button', { name: '発生土マッチ', exact: true })).toHaveAttribute('aria-current', 'page');
  await open('information', '総合インフォメーション', '総合インフォメーション');
  await open('labor', '労務安全', '労務安全');
  await open('gatekeeper', '入退場管理', '入退場管理');
  await open('conference', '調整会議', '調整会議');
  await page.getByRole('button', { name: 'サイドバーを閉じる' }).click();
  await expect(page.getByRole('button', { name: 'サイドバーを開く' })).toBeVisible();
  await page.screenshot({ path: fileURLToPath(new URL('construction-collapsed-pc.png', output)), fullPage: true });
  await page.setViewportSize({ width: 820, height: 1180 });
  await open('transport', '施工タブレット', '共通データ');
  await page.screenshot({ path: fileURLToPath(new URL('construction-home-tablet.png', output)), fullPage: true });
  expect(pageErrors).toEqual([]);
  await writeFile(new URL('evidence.json', output), JSON.stringify({
    checkedAt: new Date().toISOString(),
    base,
    release: process.env.ECODUMP_STAGING_RELEASE || '20260925-165053',
    checks,
    pageErrors,
    note: 'Read-only integrated construction screen review; formal cross-role mutation test not run.',
  }, null, 2));
  console.log('DGX integrated construction UI PASS');
} finally {
  await context.close();
  await browser.close();
}
