import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";
const credentials = JSON.parse(
  readFileSync(new URL("../server/.local/credentials.json", import.meta.url)),
);
const runTag = Date.now().toString(36);
const dir = mkdtempSync(join(tmpdir(), "ecodump-match-ui-"));
const env = {
  ...process.env,
  ECODUMP_API_PORT: "4192",
  ECODUMP_DB_PATH: join(dir, "match.sqlite"),
  WORKFLOW_API_PROXY_TARGET: "http://127.0.0.1:4192",
};
const api = spawn(process.execPath, ["server/start-workflow-api.mjs"], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  }),
  vite = spawn(
    "npm",
    [
      "run",
      "dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      "4193",
      "--strictPort",
    ],
    { cwd: process.cwd(), env, stdio: "inherit" },
  );
let browser;
const stop = () => {
  api.kill("SIGTERM");
  vite.kill("SIGTERM");
  rmSync(dir, { recursive: true, force: true });
};
const wait = async () => {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4193")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("preview did not start");
};
const create = async (page, role, title) => {
  await page.goto(
    `http://127.0.0.1:4193/?preview=app&role=${role}&page=matching`,
  );
  const panel = page.locator(".matching-live");
  await panel.waitFor();
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("検証ユーザーで接続") ||
      document.body.innerText.includes("自社の案件"),
  );
  if (
    await panel.getByRole("heading", { name: "検証ユーザーで接続" }).isVisible()
  ) {
    await panel.getByLabel("パスワード").fill(credentials.password);
    await panel.getByRole("button", { name: "接続", exact: true }).click();
    await panel.getByRole("button", { name: "自社の案件" }).waitFor();
  }
  await panel.getByRole("button", { name: "自社の案件" }).click();
  await panel.getByLabel("案件名").fill(title);
  await panel.getByLabel("地域").first().fill("匿名地域");
  await panel.getByLabel("公開情報").fill("公開検索用情報");
  await panel.getByLabel("相談相手共有情報").fill("相談開始後だけ共有");
  await panel.getByLabel("社内情報").fill("社内限定メモ");
  await panel.getByRole("button", { name: "下書き保存" }).click();
  await page.waitForTimeout(800);
  const text = await panel.innerText();
  if (!text.includes("下書きを保存しました。 DB保存後の再取得を確認しました。"))
    throw new Error(text);
  await panel
    .locator("article")
    .filter({ hasText: title })
    .getByRole("button", { name: "公開" })
    .click();
  await panel.getByText("案件を公開しました。").waitFor();
};
try {
  await wait();
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const constructionTitle = `匿名搬出案件 ${runTag}`;
  const receivingTitle = `匿名受入案件 ${runTag}`;
  await create(page, "construction", constructionTitle);
  await create(page, "receiving", receivingTitle);
  await page.goto(
    "http://127.0.0.1:4193/?preview=app&role=construction&page=matching",
  );
  let panel = page.locator(".matching-live");
  await panel.waitFor();
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("検証ユーザーで接続") ||
      document.body.innerText.includes("自社の案件"),
  );
  if (
    await panel.getByRole("heading", { name: "検証ユーザーで接続" }).isVisible()
  ) {
    await panel.getByLabel("パスワード").fill(credentials.password);
    await panel.getByRole("button", { name: "接続", exact: true }).click();
  }
  await panel
    .locator("article")
    .filter({ hasText: receivingTitle })
    .getByRole("button", { name: "事前相談" })
    .click();
  await panel.getByText(/相談メッセージを保存しました/).waitFor();
  const constructionConsultation = panel
    .locator("article")
    .filter({ hasText: runTag });
  await constructionConsultation
    .getByRole("button", { name: "条件を入力・提示" })
    .click();
  await panel.getByLabel("合意する条件").fill("匿名の受入条件で合意");
  await panel.getByLabel("相手へのメッセージ").fill("試験運用条件です");
  await panel.getByRole("button", { name: "この条件を提示" }).click();
  await panel.getByText(/条件を提示しました/).waitFor();
  await panel
    .locator("article")
    .filter({ hasText: runTag })
    .getByRole("button", { name: /同意/ })
    .click();
  await panel.getByText(/この版の条件に同意しました/).waitFor();
  await page.goto(
    "http://127.0.0.1:4193/?preview=app&role=receiving&page=matching",
  );
  panel = page.locator(".matching-live");
  await panel.waitFor();
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("検証ユーザーで接続") ||
      document.body.innerText.includes("自社の案件"),
  );
  if (
    await panel.getByRole("heading", { name: "検証ユーザーで接続" }).isVisible()
  ) {
    await panel.getByLabel("パスワード").fill(credentials.password);
    await panel.getByRole("button", { name: "接続", exact: true }).click();
  }
  await panel.getByRole("button", { name: "相談・条件調整" }).click();
  await panel
    .locator("article")
    .filter({ hasText: runTag })
    .getByRole("button", { name: /同意/ })
    .click();
  await panel.getByText(/この版の条件に同意しました/).waitFor();
  await panel.getByRole("button", { name: "成立済み" }).click();
  await panel
    .locator("article")
    .filter({ hasText: runTag })
    .getByText("合意時点の案件を確認", { exact: true })
    .waitFor();
  await page.goto(
    "http://127.0.0.1:4193/?preview=app&role=construction&page=matching",
  );
  panel = page.locator(".matching-live");
  await panel.getByRole("button", { name: "成立済み" }).click();
  const reserveButton = panel
    .locator("article")
    .filter({ hasText: runTag })
    .getByRole("button", { name: /搬出予定・搬入予約/ });
  if (await reserveButton.isDisabled()) {
    const state = await page.evaluate(() => ({ ...localStorage }));
    throw new Error(
      `予約ボタンが無効です ${JSON.stringify(state)}\n${await panel.innerText()}`,
    );
  }
  await reserveButton.click();
  await panel.getByText(/搬出予定・搬入予約を作成しました/).waitFor();
  await page.reload();
  await panel.getByRole("button", { name: "成立済み" }).click();
  await panel
    .locator("article")
    .filter({ hasText: runTag })
    .getByText(/予約申請作成済み/)
    .waitFor();
  console.log(
    "matching UI E2E: cases -> publish -> consult -> bilateral agreement -> requested reservation PASS",
  );
} finally {
  await browser?.close();
  stop();
}
