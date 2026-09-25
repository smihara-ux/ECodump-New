import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.ECODUMP_STAGING_URL || 'https://life-id.tailbe6181.ts.net:9462';
const credentials = JSON.parse(await readFile(new URL('../server/.local/dgx-staging/credentials.json', import.meta.url)));
const output = new URL('../../docs/narita-validation/staging-review/', import.meta.url);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  proxy: process.env.ECODUMP_STAGING_PROXY ? { server: process.env.ECODUMP_STAGING_PROXY } : undefined,
});
const checks = [];

async function inspect({ role, accountName, width, height, file }) {
  const account = credentials.accounts.find((item) => item.name === accountName);
  if (!account) throw new Error(`Missing staging account: ${accountName}`);
  const context = await browser.newContext({
    viewport: { width, height },
    extraHTTPHeaders: process.env.ECODUMP_STAGING_HOST ? { Host: process.env.ECODUMP_STAGING_HOST } : {},
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?data=isolated&role=${role}`, { waitUntil: 'networkidle' });
  await page.getByLabel('メールアドレス', { exact: true }).fill(account.email);
  await page.getByLabel('検証用パスワード', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await page.locator('.connected-root').waitFor();
  await page.getByLabel('表示日（日本時間）', { exact: true }).fill('2055-01-02');
  const metrics = await page.evaluate(() => ({
    title: document.title,
    overflow: document.documentElement.scrollWidth > innerWidth,
    text: document.body.innerText.slice(0, 1200),
  }));
  expect(metrics.overflow).toBe(false);
  expect(errors).toEqual([]);
  await expect(page.getByLabel('表示日（日本時間）', { exact: true })).toHaveValue('2055-01-02');
  expect(metrics.text).toContain(role === 'construction' ? '成田空港モデル現場' : role === 'receiving' ? 'モデル採石場' : '青木太郎');
  await page.screenshot({ path: fileURLToPath(new URL(file, output)), fullPage: true });
  checks.push({ role, accountName, width, height, overflow: metrics.overflow, pageErrors: errors, source: 'DGX dedicated staging', production: false });
  await context.close();
}

try {
  const landingContext = await browser.newContext({
    extraHTTPHeaders: process.env.ECODUMP_STAGING_HOST ? { Host: process.env.ECODUMP_STAGING_HOST } : {},
  });
  const landing = await landingContext.newPage();
  await landing.goto(`${base}/staging`, { waitUntil: 'networkidle' });
  await expect(landing.getByRole('heading', { name: 'ECO DUMP｜画面確認用ステージング' })).toBeVisible();
  await landingContext.close();
  await inspect({ role: 'construction', accountName: 'narita-construction', width: 1440, height: 1000, file: 'construction-pc.png' });
  await inspect({ role: 'receiving', accountName: 'narita-receiver-tochigi', width: 1440, height: 1000, file: 'receiving-pc.png' });
  await inspect({ role: 'receiving', accountName: 'narita-receiver-tochigi', width: 820, height: 1180, file: 'receiving-tablet.png' });
  await inspect({ role: 'driver', accountName: 'narita-driver-aoki', width: 390, height: 844, file: 'driver-smartphone.png' });
  await writeFile(new URL('evidence.json', output), JSON.stringify({ checkedAt: new Date().toISOString(), base, confirmationDate: '2055-01-02', checks }, null, 2));
  console.log('DGX staging UI PASS: construction PC, receiving PC/tablet, driver smartphone');
} finally {
  await browser.close();
}
