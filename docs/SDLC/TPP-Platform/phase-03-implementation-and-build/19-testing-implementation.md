# Testing Implementation â€” TPP Platform

## Test Stack

| Layer | Tool | Config File |
|-------|------|-------------|
| Unit Tests | Vitest + convex-test | vitest.config.ts |
| Component Tests | Vitest + Testing Library | vitest.config.ts |
| E2E Tests | Playwright | playwright.config.ts |
| API Tests | convex-test | convex/*.test.ts |

## Unit Test Patterns (Convex Functions)

```typescript
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const t = convexTest(schema);

test("getAll requires authentication", async () => {
  await expect(t.query(api.users.getAll)).rejects.toThrow("ERR-001");
});

test("create with valid data succeeds", async () => {
  const result = await t.mutation(api.entity.create, validData, {
    identity: { subject: "user-1", email: "test@test.com" },
  });
  expect(result).toBeDefined();
});

test("delete without admin role fails", async () => {
  await expect(
    t.mutation(api.entity.remove, { id: "..." }, {
      identity: { subject: "student-1" },
    })
  ).rejects.toThrow("ERR-002");
});
```

## E2E Test Patterns (Playwright)

```typescript
test("coordinator can create student", async ({ page }) => {
  await page.goto("/auth/login");
  await clerkLogin(page, "coordinator@test.com");
  await page.goto("/dashboard/students");
  await page.click("text=Create Student");
  await page.fill('input[name="firstName"]', "Test");
  await page.fill('input[name="lastName"]', "Student");
  await page.click('button[type="submit"]');
  await expect(page.locator("text=Created successfully")).toBeVisible();
});
```

## Coverage Targets
- Convex functions: 90%+ (auth, permissions, CRUD)
- Utility functions: 80%+
- E2E: All user journeys (J1.1 â€” J3.4)
