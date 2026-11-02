import { test, expect, type Page } from "@playwright/test";
import { credentials } from "../support/profiles";
import { cerrarVelo } from "../support/ui";
import { crearBorrador } from "../support/borradores";

/**
 * Expedición courier del personal interno: dirección de entrega (SHP-10). ESCRIBE datos (mismo seguro que alta.spec.ts).
 * Supone la interfaz en inglés.
 */
test.beforeEach(() => {
  test.skip(!credentials("staff"), "faltan credenciales del personal interno (staff)");
  test.skip(process.env.E2E_ALLOW_WRITE !== "1", "escribe datos: exige E2E_ALLOW_WRITE=1");
  test.skip((process.env.E2E_PARTNER_CLIENT ?? "").trim().length < 2, "falta E2E_PARTNER_CLIENT");
});

async function abrirDestino(page: Page, id: number) {
  await page.goto(`/shipment/${id}`);
  await page.waitForTimeout(4000);
  await cerrarVelo(page);
  await page.locator(".addr-grid > *").nth(1).click();
  const d = page.locator(".v-overlay__content", { hasText: "Delivery address" }).last();
  await expect(d).toBeVisible();
  return d;
}

test.describe.serial("Courier del personal interno: direcciones", () => {
  let envio = 0;
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ".auth/staff.json", ignoreHTTPSErrors: true });
    envio = await crearBorrador(await ctx.newPage(), "courier", "SHP-10");
    await ctx.close();
  });

  test("SHP-10-01 · la dirección de entrega se guarda y se ve en la tarjeta tras recargar", async ({ page }) => {
    const d = await abrirDestino(page, envio);
    // País desde el catálogo público (el partner no tiene master_data): sin él la dirección se guardaba sin país.
    const pais = d.getByLabel("Country (ISO)");
    await pais.click();
    await pais.pressSequentially("NL", { delay: 40 });
    await page.locator(".v-overlay--active .v-list-item", { hasText: "NL —" }).first().click();
    for (const [etiqueta, valor] of [
      ["Name / Company", "QA Consignee BV"],
      ["Address", "Keizersgracht 1"],
      ["ZIP", "1015AA"],
      ["City", "Amsterdam"],
      ["Phone", "+31201234567"],
      ["Email", "qa@example.com"],
    ] as const) {
      await d.getByLabel(etiqueta).first().fill(valor);
    }
    const guardado = page.waitForResponse((r) => r.request().method() === "POST" && /ajax_shipment_addresses/.test(r.url()));
    await d.getByRole("button", { name: /^save$/i }).click();
    const r = await guardado;
    expect(r.status()).toBe(200);
    expect((await r.json()).success).toBe(true);
    const cuerpo = r.request().postDataJSON() as { address: Record<string, unknown> };
    expect(cuerpo.address).toMatchObject({ nome: "QA Consignee BV", adress: "Keizersgracht 1", cap: "1015AA", citta: "Amsterdam" });
    expect(JSON.stringify(cuerpo.address)).toContain('"NL"');

    await page.reload();
    await page.waitForTimeout(4000);
    await cerrarVelo(page);
    await expect(page.locator(".addr-grid")).toContainText("QA Consignee BV");
    await expect(page.locator(".addr-grid")).toContainText("Amsterdam");
  });

  // Regresión del hallazgo 2026-11-01 (corregido): el partner recibía 403 en /api_master_countries (módulo master_data,
  // restringido a internos) y el desplegable «Country (ISO)» salía vacío. Ahora usa el catálogo público /get-api-countries.
  test("SHP-10 · el selector de país carga la lista para el personal interno sin errores de permisos", async ({ page }) => {
    const denegadas: string[] = [];
    page.on("response", (r) => r.status() === 403 && /api_master_countries|get-api-countries/.test(r.url()) && denegadas.push(r.url()));
    const d = await abrirDestino(page, envio);
    await d.getByLabel("Country (ISO)").click();
    await expect(page.locator(".v-overlay--active .v-list-item").first()).toBeVisible();
    expect(await page.locator(".v-overlay--active .v-list-item").count()).toBeGreaterThan(5) // la lista es virtual: solo se renderizan unas docenas;
    expect(denegadas).toEqual([]);
  });
});
