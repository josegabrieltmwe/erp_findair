import { test, expect, type Page } from "@playwright/test";
import { credentials } from "../support/profiles";
import { cerrarVelo } from "../support/ui";
import { crearBorrador } from "../support/borradores";

/**
 * Cargo del partner: cargos (voces de coste) editables en línea y accesorios (CGO-17, CGO-08, CGO-07).
 * Regresión del defecto `@change="(v: string)"`: los campos de Vuetify entregan un Event, no el valor, y
 * la SPA enviaba `costo_unit: null`, `nome: {isTrusted…}` y `somma: "S"` siempre. Los precios no se podían editar.
 * ESCRIBE datos (mismo seguro que alta.spec.ts). Supone la interfaz en inglés.
 */
test.beforeEach(() => {
  test.skip(!credentials("partner"), "faltan credenciales del partner");
  test.skip(process.env.E2E_ALLOW_WRITE !== "1", "escribe datos: exige E2E_ALLOW_WRITE=1");
  test.skip((process.env.E2E_PARTNER_CLIENT ?? "").trim().length < 2, "falta E2E_PARTNER_CLIENT");
});

async function abrirCargo(page: Page, id: number): Promise<void> {
  await page.goto(`/cargo/${id}`);
  await page.waitForTimeout(4000);
  await cerrarVelo(page);
}

test.describe.serial("Cargo del partner: importes", () => {
  let cargo = 0;
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ".auth/partner.json", ignoreHTTPSErrors: true });
    cargo = await crearBorrador(await ctx.newPage(), "cargo", "CGO-17");
    await ctx.close();
  });

  const leerCargos = async (page: Page) =>
    ((await (await page.request.get(`/bff/v1/api_cargo_shipment_charges?cargo_id=${cargo}`)).json()).items ??
      []) as Array<Record<string, unknown>>;

  test("CGO-17 · alta y edición en línea de una voz de coste se guardan con los valores tecleados", async ({ page }) => {
    await abrirCargo(page, cargo);
    await page.locator("section:has(.mdi-currency-eur), .v-card:has(.mdi-currency-eur)").locator("button:has(.mdi-pencil-outline), button:has(.mdi-pencil)").first().click();
    const modal = page.locator(".v-overlay__content", { hasText: "Costs and charge" }).last();
    await modal.locator(".v-tab").nth(1).click();
    await modal.getByRole("button", { name: /add/i }).first().click();

    const alta = page.locator(".v-overlay__content", { hasText: "Add charge row" }).last();
    await alta.getByLabel("Code").fill("QA1");
    await alta.getByLabel("Description").fill("QA charge");
    await alta.getByLabel("Unit cost").fill("12.5");
    await alta.getByLabel("Min", { exact: true }).fill("5");
    await alta.getByLabel("Max", { exact: true }).fill("50");
    const creado = page.waitForResponse((r) => r.request().method() === "POST" && /api_cargo_shipment_charges/.test(r.url()));
    await alta.getByRole("button", { name: /^add$/i }).click();
    expect((await creado).status()).toBe(201);

    const fila = page.locator(".charges-listing tbody tr").first();
    const patch = async (campo: ReturnType<typeof fila.locator>, valor: string) => {
      const r = page.waitForResponse((x) => x.request().method() === "PATCH" && /api_cargo_shipment_charges/.test(x.url()));
      await campo.fill(valor);
      await campo.blur();
      const resp = await r;
      expect(await resp.text(), "el API no debe devolver un error con HTTP 200").not.toContain("update_failed");
      return resp.request().postDataJSON() as Record<string, unknown>;
    };
    expect((await patch(fila.locator("input[type=number]").nth(0), "20")).costo_unit).toBe(20);
    expect((await patch(fila.locator("input[type=text]").nth(1), "QA renamed")).nome).toBe("QA renamed");

    const sw = page.waitForResponse((x) => x.request().method() === "PATCH" && /api_cargo_shipment_charges/.test(x.url()));
    await fila.locator("input[type=checkbox]").first().click({ force: true });
    expect(((await sw).request().postDataJSON() as Record<string, unknown>).somma).toBe("N");

    // Lectura directa del API: lo guardado es lo tecleado.
    const guardado = (await leerCargos(page)).find((c) => c.code === "QA charge" || c.code === "QA1");
    expect(guardado).toBeTruthy();
    expect(Number(guardado!.costo_unit)).toBe(20);
    expect(guardado!.nome).toBe("QA renamed");
    expect(guardado!.somma).toBe("N");
  });

  test("CGO-07 · los interruptores de accesorios (hielo seco, palé) envían el valor booleano", async ({ page }) => {
    await abrirCargo(page, cargo);
    const tarjeta = page.locator("section:has-text('Dry ice'), .v-card:has-text('Dry ice')").first();
    const interruptor = tarjeta.locator("input[type=checkbox]").first();
    const patch = page.waitForResponse((r) => ["PATCH", "PUT", "POST"].includes(r.request().method()) && /unified_cargo_shipment|api_cargo/.test(r.url()));
    await interruptor.click({ force: true });
    const r = await patch;
    expect(JSON.stringify(r.request().postDataJSON() ?? {})).not.toContain("isTrusted");
    expect(r.status()).toBeLessThan(300);
    await expect(interruptor).toBeChecked();
  });
});
