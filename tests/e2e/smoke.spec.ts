/**
 * Playwright e2e smoke test.
 * Verifies the app starts and the home page renders.
 * WS-3 will add real UI tests here.
 */

import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Scholarship Finder/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Scholarship Finder"
  );
});
