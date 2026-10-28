import { test, expect } from "../support/test";

test.describe("Garantías del BFF vistas desde la UI", () => {
  test("SEC-01 ningún token OAuth en el almacenamiento del navegador", async ({ page }) => {
    await page.goto("/home");
    const dump = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(dump).not.toMatch(/access_token|refresh_token|Bearer /i);
  });

  test("SEC-02 la cookie de sesión es HttpOnly y Secure", async ({ page, context }) => {
    await page.goto("/home");
    const c = (await context.cookies()).filter((x) => /sess|erp/i.test(x.name));
    expect(c.length).toBeGreaterThan(0);
    for (const k of c) {
      expect(k.httpOnly).toBe(true);
      expect(k.secure).toBe(true);
    }
  });

  test("SEC-03 un POST sin cabecera CSRF es rechazado", async ({ request }) => {
    const r = await request.post("/bff/v1/api_anagrafica_findair_access", { data: {} });
    expect([400, 403, 419]).toContain(r.status());
  });
});
