import { test, expect } from "@playwright/test";

test.describe("Sin sesión", () => {
  test("AUTH-01 /bff/auth/session informa authenticated:false sin cookie", async ({ request }) => {
    const r = await request.get("/bff/auth/session");
    expect(r.ok()).toBeTruthy();
    expect(await r.json()).toEqual({ authenticated: false });
  });

  test("AUTH-02 el proxy rechaza una acción sin sesión", async ({ request }) => {
    const r = await request.get("/bff/v1/api_anagrafica_findair_access");
    expect(r.status()).toBeGreaterThanOrEqual(401);
    expect(r.status()).toBeLessThan(500);
  });

  test("AUTH-03 la SPA sin sesión redirige al login", async ({ page }) => {
    await page.goto("/home");
    await page.waitForURL(/auth|login/, { timeout: 15_000 });
  });
});
