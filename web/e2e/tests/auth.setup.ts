import { test as setup, expect } from "@playwright/test";

const user = process.env.E2E_USER;
const pass = process.env.E2E_PASS;

/** Login OAuth2/PKCE real vía el formulario del backend; guarda la cookie de sesión del BFF. */
setup("login", async ({ page }) => {
  if (!user || !pass) throw new Error("Defina E2E_USER y E2E_PASS (usuario de pruebas, nunca uno real de producción).");
  await page.goto("/bff/auth/login");
  // Formulario de tmwe_json: ajustar selectores si cambia.
  await page.locator('input[name="username"], input[type="email"]').first().fill(user);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.includes("/bff/auth"), { timeout: 20_000 });
  const res = await page.request.get("/bff/auth/session");
  expect(res.ok()).toBeTruthy();
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
