import { test, expect } from "../support/test";
import { SMOKE_ROUTES } from "../support/routes";

/** SMK: cada pantalla monta dentro del shell, sin errores de consola ni 5xx del BFF. */
for (const r of SMOKE_ROUTES) {
  test(`SMK-${r.id} ${r.path} monta sin errores`, async ({ page }) => {
    const errors: string[] = [];
    const bad: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (res) => {
      if (res.url().includes("/bff/") && res.status() >= 500) bad.push(`${res.status()} ${res.url()}`);
    });
    await page.goto(r.path);
    await expect(page.locator(".v-application")).toBeVisible();
    await page.waitForLoadState("networkidle");
    // 403 en pantallas admin es válido si el usuario de pruebas no es admin: se acepta pantalla de acceso denegado.
    expect(errors, "errores JS").toEqual([]);
    expect(bad, "respuestas 5xx del BFF").toEqual([]);
  });
}
