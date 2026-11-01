import { test, expect, type Page } from "@playwright/test";
import { credentials } from "../support/profiles";
import { cerrarVelo } from "../support/ui";
import { crearBorrador } from "../support/borradores";

/**
 * Expedición courier del partner: dirección de entrega (SHP-10). ESCRIBE datos (mismo seguro que alta.spec.ts).
 * Supone la interfaz en inglés.
 */
test.beforeEach(() => {
  test.skip(!credentials("partner"), "faltan credenciales del partner");
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

test.describe.serial("Courier del partner: direcciones", () => {
  let envio = 0;
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ".auth/partner.json", ignoreHTTPSErrors: true });
    envio = await crearBorrador(await ctx.newPage(), "courier", "SHP-10");
    await ctx.close();
  });

  test("SHP-10-01 · la dirección de entrega se guarda y se ve en la tarjeta tras recargar", async ({ page }) => {
    const d = await abrirDestino(page, envio);
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

    await page.reload();
    await page.waitForTimeout(4000);
    await cerrarVelo(page);
    await expect(page.locator(".addr-grid")).toContainText("QA Consignee BV");
    await expect(page.locator(".addr-grid")).toContainText("Amsterdam");
  });

  // HALLAZGO 2026-11-01: el partner recibe 403 en /api_master_countries (falta master_data:read, P58): el
  // desplegable «Country (ISO)» queda vacío y la dirección se guarda SIN país (el payload no lo lleva) y
  // sin aviso. Sin país no se puede tarifar ni expedir. Pasará a rojo cuando se conceda el scope.
  test("SHP-10 · el selector de país carga la lista para el partner", async ({ page }) => {
    test.fail(true, "api_master_countries devuelve 403 al partner (P58)");
    const denegadas: string[] = [];
    page.on("response", (r) => r.status() === 403 && /api_master_countries/.test(r.url()) && denegadas.push(r.url()));
    const d = await abrirDestino(page, envio);
    await d.getByLabel("Country (ISO)").click();
    await page.waitForTimeout(1500);
    expect(denegadas).toEqual([]);
    await expect(page.locator(".v-overlay--active .v-list-item").first()).toBeVisible();
  });
});
