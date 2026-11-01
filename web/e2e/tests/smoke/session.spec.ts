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

// AC-08: hasta que exista la vista «No autorizado» este caso falla por diseño (ver docs/plan-pruebas-ui.md §6).
test.fixme("SINACC ve «No tienes acceso» y no dispara los KPI del dashboard", async ({ page }, info) => {
  test.skip(info.project.name !== "sinacc" || !credentials("sinacc"));
  const kpis: string[] = [];
  page.on("request", (r) => /api_(courier_kpis|cargo_kpis|home_box_indicators)/.test(r.url()) && kpis.push(r.url()));
  await page.goto("/");
  expect(kpis).toEqual([]);
});
