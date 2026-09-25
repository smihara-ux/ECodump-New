import { test, expect } from "@playwright/test";

for (const width of [1440, 820]) {
  test(`実績数量・単位・差異理由を確認してから送信 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/?preview=app");
    await page.evaluate(async () => {
      const { default: React } = await import("/node_modules/.vite/deps/react.js");
      const { default: ReactDOM } = await import("/node_modules/.vite/deps/react-dom_client.js");
      const { default: Form } = await import("/src/receiving/ReceivingActualForm.jsx");
      const host = document.createElement("div");
      host.id = "actual-form-fixture";
      Object.assign(host.style, { position: "fixed", inset: "0", zIndex: "10000", background: "white", color: "#17312b", padding: "24px", overflow: "auto" });
      document.body.append(host);
      window.actualSubmissions = [];
      ReactDOM.createRoot(host).render(React.createElement(Form, { plannedQuantity: 8, unit: "m3", busy: false, onConfirm: (value) => window.actualSubmissions.push(value) }));
    });
    const form = page.locator("#actual-form-fixture");
    const confirm = form.getByRole("button", { name: "受入実績を確定" });
    await expect(confirm).toBeDisabled();
    await expect(form.getByText("予定数量：")).toContainText("8 m³");
    await form.getByLabel("実績数量（m³）").fill("7.8");
    await expect(form.getByRole("checkbox")).toBeDisabled();
    await form.getByLabel("予定との差異理由", { exact: false }).fill("受入時の実測差");
    await expect(confirm).toBeDisabled();
    await form.getByRole("checkbox").check();
    await confirm.click();
    expect(await page.evaluate(() => window.actualSubmissions)).toEqual([{ quantity: 7.8, unit: "m3", differenceReason: "受入時の実測差" }]);
    await form.getByLabel("実績数量（m³）").fill("7.9");
    await expect(confirm).toBeDisabled();
    expect(await form.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}
