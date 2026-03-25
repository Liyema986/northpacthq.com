import { test, expect } from "@playwright/test";

/**
 * E2E Tests â€” Authentication Flow
 */

test("user can sign in and access dashboard", async ({ page }) => {
  await page.goto("/auth/login");
  await page.fill('input[name="email"]', "test@example.com");
  await page.fill('input[name="password"]', "password");
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator("text=Dashboard")).toBeVisible();
});

test("unauthenticated user is redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/auth/login");
});
