import { expect, test } from "@playwright/test";

const routes = [
  "fields",
  "matching",
  "control",
  "labor",
  "gatekeeper",
  "conference",
  "transport",
  "company",
  "users",
  "vehicles",
  "agencies",
  "agency-request",
  "prime-contractors",
  "field&fieldId=32182",
];

for (const theme of ["light", "dark"]) {
  for (const route of routes) {
    test(`${route} renders without overflow in ${theme} mode`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("ecodump-theme", selectedTheme);
      }, theme);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/?preview=app&page=${route}`);
      await expect(page.locator(".app-shell")).toBeVisible();
      await expect(page.locator(".content")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(2);
      expect(errors).toEqual([]);
    });
  }
}

for (const viewport of [
  { name: "tablet", width: 1024, height: 768 },
  { name: "phone", width: 390, height: 844 },
]) {
  for (const route of ["fields", "control", "field&fieldId=32182"]) {
    test(`${route} keeps primary UI reachable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/?preview=app&page=${route}`);
      await expect(page.locator(".content")).toBeVisible();
      if (viewport.name === "phone") {
        await expect(page.locator(".mobile-menu")).toBeVisible();
      } else {
        await expect(page.locator(".sidebar .collapse")).toBeVisible();
      }
      const unlabeledButtons = await page.locator("button").evaluateAll((buttons) =>
        buttons.filter((button) => {
          const label = button.getAttribute("aria-label") || button.title || button.textContent;
          return !label?.trim();
        }).length,
      );
      expect(unlabeledButtons).toBe(0);
    });
  }
}
