import { test, expect } from "@playwright/test";
import { EXPECTED_CAPABILITIES, credentials, type Profile } from "../support/profiles";

// AC-02 y base de AC-08/AC-09: la sesión de cada perfil trae las capacidades esperadas.
test("la sesión trae las capacidades del perfil", async ({ request }, info) => {
  const p = info.project.name as Profile;
  test.skip(!credentials(p), `sin credenciales para ${p}`);
  const body = await (await request.get("/bff/auth/session")).json();
  expect(body.authenticated).toBe(true);
  expect(body.capabilities).toEqual(EXPECTED_CAPABILITIES[p]);
});

// AC-08: un cliente sin erp_operator (el API responde 403 ERP_ACCESS_DENIED al contexto) ve «sin acceso»
// y la SPA no lanza ninguna llamada de negocio.
test("SINACC ve «No tienes acceso» y no dispara los KPI del dashboard", async ({ page }, info) => {
  test.skip(info.project.name !== "sinacc" || !credentials("sinacc"));
  const negocio: string[] = [];
  page.on("request", (r) => /\/bff\/v1\//.test(r.url()) && negocio.push(r.url()));
  await page.goto("/");
  await expect(page.getByText(/do not have access|no tienes acceso|non hai accesso/i).first()).toBeVisible();
  await page.waitForTimeout(3000);
  expect(negocio).toEqual([]);
});
