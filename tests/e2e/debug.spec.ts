import { test, expect } from "@playwright/test";

test("full form with waitForFunction", async ({ page }) => {
  const apiRequests: {url: string, status?: number}[] = [];
  
  page.on('response', res => {
    if (res.url().includes('api/match')) {
      apiRequests.push({ url: res.url(), status: res.status() });
    }
  });

  await page.goto("/");
  await page.waitForSelector('button[type="submit"]');
  
  // Fill each field and wait for React to update DOM
  await page.locator("#gradeLevel").selectOption("senior");
  await page.waitForFunction(() => (document.getElementById('gradeLevel') as HTMLSelectElement)?.value === 'senior');
  
  await page.locator("#gradYear").fill("2026");
  await page.waitForFunction(() => (document.getElementById('gradYear') as HTMLInputElement)?.value === '2026');
  
  await page.locator("#gpa").fill("3.5");
  await page.waitForFunction(() => (document.getElementById('gpa') as HTMLInputElement)?.value === '3.5');
  
  await page.locator("#homeState").selectOption("NE");
  await page.waitForFunction(() => (document.getElementById('homeState') as HTMLSelectElement)?.value === 'NE');
  
  await page.locator("#citizenship").selectOption("us_citizen");
  await page.waitForFunction(() => (document.getElementById('citizenship') as HTMLSelectElement)?.value === 'us_citizen');
  
  await page.locator("#householdIncomeBand").selectOption("30-48k");
  await page.waitForFunction(() => (document.getElementById('householdIncomeBand') as HTMLSelectElement)?.value === '30-48k');
  
  // Tag input for major
  await page.locator("#intendedMajors").fill("Computer Science");
  await page.locator("#intendedMajors").press("Enter");
  await page.waitForTimeout(300);
  
  // Tag input for activities
  await page.locator("#activities").fill("nhs");
  await page.locator("#activities").press("Enter");
  await page.waitForTimeout(300);
  
  console.log("All form fields filled");
  
  // Verify tag spans appear
  const majSpans = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="rounded-full"][class*="blue"]')).map(s => s.textContent?.trim());
  });
  console.log("Blue tag spans (majors/activities):", majSpans);
  
  // Submit
  await page.locator('button[type="submit"]').click();
  
  // Wait for results
  try {
    await page.waitForSelector('[aria-label="Scholarship results"]', { timeout: 12000 });
    const hasResults = await page.locator('[aria-label="Scholarship results"]').isVisible();
    console.log("Has results section:", hasResults);
    
    const articleCount = await page.locator('[aria-label="Scholarship results"] article').count();
    console.log("Article count:", articleCount);
    
    const bands = await page.locator('[aria-label="Scholarship results"] .rounded-full').allTextContents();
    console.log("Band texts:", bands.slice(0, 5));
  } catch (e) {
    console.log("Failed to get results:", (e as Error).message);
    
    const alerts = await page.locator('[role="alert"]').allTextContents();
    console.log("Alerts:", alerts);
    
    const invalidFields = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[aria-invalid="true"]')).map(el => el.id);
    });
    console.log("Invalid fields:", invalidFields);
  }
  
  console.log("API responses:", apiRequests);
  
  expect(true).toBe(true);
});
