import { test, expect } from "@playwright/test";
import { credentials, type Profile } from "../support/profiles";
import { staticRoutes } from "../support/routes";

// Fase «humo por perfil» de docs/plan-pruebas-ui.md §4: todas las rutas sin parámetros, sin 5xx ni excepciones de página.
// SINACC queda fuera hasta que exista el guard (cada ruta dispararía 403 de negocio).
const routes = staticRoutes();

test.describe("humo de rutas", () => {
  test.beforeEach(({}, info) => {
    const p = info.project.name as Profile;
    test.skip(!credentials(p), `sin credenciales para ${p}`);
    test.skip(p === "sinacc", "pendiente del guard de acceso no autorizado");
  });

  test("hay rutas que recorrer", () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  for (const r of routes) {
    test(`${r.path}`, async ({ page }, info) => {
      const p = info.project.name as Profile;
      const serverErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("response", (res) => {
        if (res.url().includes("/bff/") && res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`);
      });
      page.on("pageerror", (e) => pageErrors.push(e.message));

      await page.goto(r.path, { waitUntil: "networkidle" });

      // Un perfil sin permisos de administración no debe quedarse en una ruta requiresAdmin (NV-02).
      if (r.requiresAdmin && p === "partner") {
        expect(new URL(page.url()).pathname, "ruta de administración visible para un partner").not.toBe(r.path);
      }
      expect(serverErrors, "respuestas 5xx del BFF").toEqual([]);
      expect(pageErrors, "excepciones de la página").toEqual([]);
    });
  }
});
