import { test, expect } from "@playwright/test";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { credentials } from "../support/profiles";
import { cerrarVelo } from "../support/ui";

/**
 * Detalle de la expedición courier del partner (SHP-09 colli, humo de carga).
 * Reutiliza el último borrador anotado por alta.spec.ts (.auth/ids-creados.txt); sin él, se omite.
 * Escribe (pieces/peso del borrador): mismo seguro que alta.spec.ts.
 */
const ALLOWED = process.env.E2E_ALLOW_WRITE === "1";

function ultimo(tipo: string): string | null {
  const f = ".auth/ids-creados.txt";
  if (!existsSync(f)) return null;
  const l = readFileSync(f, "utf8").trim().split("\n").filter((x) => x.includes(` ${tipo} `));
  return l.length ? new URL(l[l.length - 1].split(" ").pop()!).pathname : null;
}

test.beforeEach(() => {
  test.skip(!credentials("partner"), "faltan credenciales del partner");
  test.skip(!ALLOWED, "escribe datos: exige E2E_ALLOW_WRITE=1");
});

test("SHP · el detalle del borrador carga sin errores de permisos para el partner", async ({ page }) => {
  // Regresión (corregido 2026-11-01): antes el detalle disparaba GET /api_master_currencies → 403 (master_data, solo
  // internos) y la SPA mostraba «No tienes permiso para esta acción». Ahora los desplegables usan los catálogos públicos.
  const ruta = ultimo("SHP-01");
  test.skip(!ruta, "no hay borrador courier anotado; ejecuta antes npm run test:alta");
  const denegadas: string[] = [];
  page.on("response", (r) => {
    const u = r.url().replace(/^https?:\/\/[^/]+/, "");
    if (r.status() === 403 && u.startsWith("/bff/v1/")) denegadas.push(u);
  });
  await page.goto(ruta!);
  await page.waitForTimeout(5000);
  expect(denegadas).toEqual([]);
  await expect(page.locator(".v-snackbar")).toHaveCount(0);
});

async function abrirColli(page: import("@playwright/test").Page) {
  const ruta = ultimo("SHP-01");
  test.skip(!ruta, "no hay borrador courier anotado; ejecuta antes npm run test:alta");
  await page.goto(ruta!);
  await page.waitForTimeout(4000);
  await cerrarVelo(page);
  await page.locator("section.card-tmwe:has(.mdi-package-variant) button:has(.mdi-pencil-outline)").first().click();
  return page.locator(".v-overlay--active .v-overlay__content").last();
}
const tarjetaMedidas = (page: import("@playwright/test").Page) =>
  page.locator("section.card-tmwe:has(.mdi-package-variant)").first();

test("SHP-09 · el peso de un bulto con medidas se guarda y suma al total tras recargar", async ({ page }) => {
  const dlg = await abrirColli(page);
  await dlg.locator("button:has-text('Add row')").click();
  const fila = dlg.locator("tbody tr").last().locator("input");
  await fila.nth(1).fill("3.5"); // peso
  await fila.nth(2).fill("10");
  await fila.nth(3).fill("20");
  await fila.nth(4).fill("30");
  await fila.nth(4).blur();
  const guardado = page.waitForResponse((r) => r.request().method() === "POST" && /ajax_shipment_packages/.test(r.url()));
  await dlg.locator("button:has(.mdi-content-save-outline)").click();
  const r = await guardado;
  expect(r.status(), (await r.text()).slice(0, 200)).toBeLessThan(300);
  expect((await r.json()).success).toBe(true);
  await page.reload();
  await page.waitForTimeout(3000);
  await cerrarVelo(page);
  // El total pasa a ser la suma de los bultos (≥ 3,5 kg; el borrador acumula filas entre ejecuciones).
  const texto = (await tarjetaMedidas(page).innerText()).replace(/\n/g, " ");
  const kg = Number(/Weight\s+([\d.,]+)\s*kg/.exec(texto)?.[1].replace(",", "."));
  expect(kg, texto).toBeGreaterThanOrEqual(3.5);
});

test("SHP-09 · en un borrador nuevo, bultos y peso del encabezado coinciden con las filas guardadas", async ({ page }) => {
  // Borrador propio (no reutiliza el anotado) para no arrastrar filas de otras ejecuciones.
  await page.goto("/shipment/new");
  await cerrarVelo(page);
  await page.locator(".v-main .v-autocomplete input").first().fill(process.env.E2E_PARTNER_CLIENT ?? "");
  await page.locator(".v-overlay--active .v-list-item").first().click();
  await page.locator("button:has(.mdi-check)").last().click();
  await page.waitForURL(/\/shipment\/\d+/, { timeout: 30_000 });
  appendFileSync(".auth/ids-creados.txt", `${new Date().toISOString()} SHP-09 ${page.url()}\n`);
  await page.waitForTimeout(4000);
  await cerrarVelo(page);
  await page.locator("section.card-tmwe:has(.mdi-package-variant) button:has(.mdi-pencil-outline)").first().click();
  const dlg = page.locator(".v-overlay--active .v-overlay__content").last();
  for (const kg of ["3.5", "2"]) {
    await dlg.locator("button:has-text('Add row')").click();
    const fila = dlg.locator("tbody tr").last().locator("input");
    await fila.nth(1).fill(kg);
    await fila.nth(4).blur();
  }
  const guardado = page.waitForResponse((r) => r.request().method() === "POST" && /ajax_shipment_packages/.test(r.url()));
  await dlg.locator("button:has(.mdi-content-save-outline)").click();
  await guardado;
  await page.reload();
  await page.waitForTimeout(4000);
  await cerrarVelo(page);
  const texto = (await tarjetaMedidas(page).innerText()).replace(/\n/g, " ");
  const bultos = Number(/Packages\s+(\d+)/.exec(texto)?.[1]);
  const kg = Number(/Weight\s+([\d.,]+)\s*kg/.exec(texto)?.[1].replace(",", "."));
  expect({ bultos, kg }, texto).toEqual({ bultos: 2, kg: 5.5 });
});
