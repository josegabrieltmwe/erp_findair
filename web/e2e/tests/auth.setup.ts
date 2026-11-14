import { test as setup, expect } from "@playwright/test";
import { PROFILES, credentials } from "./support/profiles";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";

mkdirSync(".auth", { recursive: true });

for (const p of PROFILES) {
  setup(`login ${p}`, async ({ page }) => {
    const file = `.auth/${p}.json`;
    const c = credentials(p);
    if (!c) {
      // Sin credenciales: estado vacío para que el proyecto exista y sus tests se omitan.
      if (!existsSync(file)) writeFileSync(file, JSON.stringify({ cookies: [], origins: [] }));
      setup.skip(true, `faltan E2E_${p.toUpperCase()}_USER / E2E_${p.toUpperCase()}_PASS`);
      return;
    }
    // Flujo real: BFF → pantalla de login del API (api.php8) → callback del BFF → SPA.
    await page.goto("/bff/auth/login");
    await page.locator("#oauth-login-username").fill(c.user);
    await page.locator("#oauth-login-password").fill(c.pass);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((u) => u.origin === new URL(page.url()).origin && !u.pathname.startsWith("/bff/auth"), {
      timeout: 30_000,
    });
    const res = await page.request.get("/bff/auth/session");
    const session = await res.json();
    expect(session.authenticated, `sesión de ${p}`).toBe(true);
    await page.context().storageState({ path: file });
  });
}
