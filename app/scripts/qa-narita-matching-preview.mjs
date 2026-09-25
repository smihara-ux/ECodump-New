import { chromium, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const credentials = JSON.parse(await readFile(new URL(process.env.MATCHING_CREDENTIALS || '../server/.local/credentials.json', import.meta.url)));
const base = process.env.MATCHING_PREVIEW_URL || 'http://127.0.0.1:4178';
const output = new URL('../../docs/narita-validation/matching-ui/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ proxy: process.env.MATCHING_PREVIEW_PROXY ? { server: process.env.MATCHING_PREVIEW_PROXY } : undefined });
const evidence = [];

async function inspect(role, accountName, width, expectedTitle, filename) {
  const account = credentials.accounts.find((item) => item.name === accountName);
  if (!account) throw new Error(`Missing local validation account: ${accountName}`);
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const managementPage = role === 'construction' ? 'transport' : 'receiving-locations';
  const returnPage = 'transport';
  await page.goto(`${base}/?preview=app&role=${role}&page=${managementPage}`);
  await page.getByRole('button', { name: 'ログインして保存を利用' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('メールアドレス').fill(account.email);
  await dialog.getByLabel('パスワード', { exact: true }).fill(credentials.password);
  await dialog.getByRole('button', { name: 'ログイン', exact: true }).click();
  const suiteEntry = page.getByRole('button', { name: '発生土マッチ', exact: true });
  if (!(await suiteEntry.isVisible().catch(() => false))) await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  await suiteEntry.click();
  await expect(page).toHaveURL(/page=matching/);
  const matching = page.locator('.shared-match');
  await expect(matching.getByRole('button', { name: '探す', exact: true })).toBeVisible();
  await expect(matching).toContainText(expectedTitle);
  await expect(matching).toContainText('距離・適合度・経路料金は未接続のため確定値を表示しません。');
  const candidate = matching.locator('.matching-live-list article').filter({ hasText: expectedTitle });
  await candidate.getByRole('button', { name: '案件詳細' }).click();
  const detail = matching.getByRole('region', { name: '案件詳細' });
  await expect(detail).toContainText('第2種建設発生土');
  await expect(detail).toContainText('10 m³');
  await expect(detail).toContainText('2026-09-25〜2026-12-31');
  await expect(detail).toContainText('公開情報・条件');
  await detail.getByRole('button', { name: '閉じる' }).click();
  await matching.getByRole('button', { name: '自社の案件', exact: true }).click();
  await expect(matching.getByRole('heading', { name: '新しい案件を登録' })).toBeVisible();
  await expect(matching.getByLabel(role === 'construction' ? '搬出場所' : '受入場所')).toBeVisible();
  await expect(matching.getByLabel('相談相手共有情報・受入条件')).toBeVisible();
  await expect(matching.getByLabel('社内情報（相手には非公開）')).toBeVisible();
  await matching.getByRole('button', { name: '相談・条件調整', exact: true }).click();
  await expect(matching.getByText('相談はまだありません。「探す」から公開案件を選んでください。')).toBeVisible();
  await matching.getByRole('button', { name: '成立済み', exact: true }).click();
  await expect(matching.getByText('条件合意は予約確定・配車完了とは別です。合意時点の案件と提示条件を保持します。')).toBeVisible();
  await expect(matching.getByText('双方で合意した案件はまだありません。')).toBeVisible();
  await matching.getByRole('button', { name: '探す', exact: true }).click();
  const matchingEntry = page.getByRole('button', { name: '発生土マッチ', exact: true });
  if (!(await matchingEntry.count())) await page.getByRole('button', { name: 'サイドバーを開く' }).click();
  await expect(matchingEntry).toBeVisible();
  await expect(page.locator('aside.sidebar > nav').getByText('発生土マッチ', { exact: true })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`${role} ${width}px has horizontal document overflow`);
  if (errors.length) throw new Error(`${role} page errors: ${errors.join(' | ')}`);
  await page.screenshot({ path: fileURLToPath(new URL(filename, output)), fullPage: true });
  const sidebarStyle = await page.locator('aside.sidebar').evaluate((element) => {
    const style = getComputedStyle(element);
    return { width: style.width, flex: style.flex, minWidth: style.minWidth, maxWidth: style.maxWidth };
  });
  evidence.push({ role, account: accountName, width, expectedTitle, sidebarStyle, documentOverflow: overflow, pageErrors: errors });
  await matching.getByRole('button', { name: role === 'construction' ? '施工側管理へ戻る' : '受入側管理へ戻る' }).click();
  await expect(page).toHaveURL(new RegExp(`page=${returnPage}`));
  await context.close();
}

try {
  await inspect('construction', 'narita-construction', 1440, '栃木モデル採石場・受入案件〈架空〉', 'construction-desktop.png');
  await inspect('receiving', 'narita-receiver-tochigi', 820, '成田モデルA工区・搬出案件〈検証用〉', 'receiving-tablet.png');
  await writeFile(new URL('evidence.json', output), JSON.stringify({ environment: base.includes('tailbe6181') ? 'dgx-staging' : 'local-isolated', base, production: false, formalEndToEndExecuted: false, checks: evidence }, null, 2));
  console.log('Narita matching preview UI PASS: shared cases, labels, uncalculated-data warning, entry point, desktop/tablet layout');
} finally {
  await browser.close();
}
