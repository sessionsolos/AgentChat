/**
 * End-to-end happy-path test for the scholarship finder.
 *
 * Scenario: a Nebraska senior (Grade 12) with a 3.5 GPA, US citizenship,
 * income band $30–48k, Computer Science major, and NHS activity submits
 * the intake form. The test verifies that:
 *
 *   1. Ranked result cards render after submission.
 *   2. At least one feasibility band badge is visible.
 *   3. A source citation link is present (a[href] inside a card).
 *   4. The disclaimer text is visible.
 *
 * Prerequisites: the dev server is started by Playwright's webServer config,
 * and the SQLite DB must be seeded (`npx prisma db seed`) before running.
 */

import { test, expect } from "@playwright/test";

test.describe("Happy-path: Nebraska junior/senior intake form", () => {
  test("submits form and shows ranked results with band badges, citations, and disclaimer", async ({ page }) => {
    // -----------------------------------------------------------------------
    // 1. Load home page
    // -----------------------------------------------------------------------
    await page.goto("/");
    await expect(page).toHaveTitle(/Scholarship Finder/);

    // -----------------------------------------------------------------------
    // 2. Fill in the form
    // -----------------------------------------------------------------------

    // Grade Level: Senior
    await page.selectOption("#gradeLevel", "senior");

    // Grad Year
    await page.fill("#gradYear", "2026");

    // GPA
    await page.fill("#gpa", "3.5");

    // GPA Scale (already defaults to 4.0, but set explicitly)
    await page.selectOption("#gpaScale", "4.0");

    // Home State: Nebraska
    await page.selectOption("#homeState", "NE");

    // Citizenship: U.S. Citizen
    await page.selectOption("#citizenship", "us_citizen");

    // Household Income: $30,000 – $48,000
    await page.selectOption("#householdIncomeBand", "30-48k");

    // Intended Major: type "Computer Science" into the tag input and press Enter
    await page.fill("#intendedMajors", "Computer Science");
    await page.press("#intendedMajors", "Enter");

    // Activity: type "nhs" and press Enter so the tag value "nhs" gets added.
    // This matches the hard `hasActivity: "nhs"` requirement in nhs-scholarship-2026.
    await page.fill("#activities", "nhs");
    await page.press("#activities", "Enter");

    // -----------------------------------------------------------------------
    // 3. Submit the form
    // -----------------------------------------------------------------------
    await page.click('button[type="submit"]');

    // -----------------------------------------------------------------------
    // 4. Wait for results section to appear
    // -----------------------------------------------------------------------
    const resultsSection = page.locator('[aria-label="Scholarship results"]');
    await expect(resultsSection).toBeVisible({ timeout: 15000 });

    // -----------------------------------------------------------------------
    // 5. At least one result card is rendered
    // -----------------------------------------------------------------------
    // ResultCard renders as <article aria-label="[scholarship name]">
    const firstCard = resultsSection.locator("article").first();
    await expect(firstCard).toBeVisible();

    // -----------------------------------------------------------------------
    // 6. At least one feasibility band badge is visible
    //    Band labels: "Strong Match", "Possible Match", "Reach"
    // -----------------------------------------------------------------------
    const bandBadge = resultsSection
      .locator("text=/Strong Match|Possible Match|Reach/")
      .first();
    await expect(bandBadge).toBeVisible();

    // -----------------------------------------------------------------------
    // 7. At least one source citation link is present
    //    Citations are rendered as: Source: <a href="...">sourceName</a>
    // -----------------------------------------------------------------------
    const citationLink = resultsSection.locator("a[href]").first();
    await expect(citationLink).toBeVisible();
    // The href should be a real URL (starts with http)
    const href = await citationLink.getAttribute("href");
    expect(href).toMatch(/^https?:\/\//);

    // -----------------------------------------------------------------------
    // 8. Disclaimer text is visible in the results section
    //    The compact disclaimer ("Informational only") appears in ResultsPanel
    // -----------------------------------------------------------------------
    const disclaimer = resultsSection.locator("text=/Informational only/").first();
    await expect(disclaimer).toBeVisible();

    // -----------------------------------------------------------------------
    // 9. Nebraska-specific check: susan-buffett-scholarship-2026 should appear
    //    (NE hard requirement, this student qualifies)
    // -----------------------------------------------------------------------
    const buffettCard = resultsSection.locator(
      'article[aria-label="Susan Thompson Buffett Foundation Scholarship"]'
    );
    await expect(buffettCard).toBeVisible();
  });
});
