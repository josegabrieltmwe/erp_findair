import { test, expect, type Page } from "@playwright/test";
import { credentials } from "../support/profiles";
import { cerrarVelo } from "../support/ui";
import { crearBorrador } from "../support/borradores";

/**
 * Cargo del partner: MAWB y HAWB (CGO-14, CGO-15, CGO-24). ESCRIBE datos (mismo seguro que alta.spec.ts).
 * No reserva vuelo, no confirma el MAWB, no envía correos (api_awb_email está bloqueado en el BFF local).
 * Supone la interfaz en inglés (idioma del usuario de pruebas).
 */
test.beforeEach(() => {
  test.skip(!credentials("partner"), "faltan credenciales del partner");
  test.skip(process.env.E2E_ALLOW_WRITE !== "1", "escribe datos: exige E2E_ALLOW_WRITE=1");
  test.skip((process.env.E2E_PARTNER_CLIENT ?? "").trim().length < 2, "falta E2E_PARTNER_CLIENT");
});

/** AWB de pruebas con prefijo 999 y dígito de control válido (serie mod 7), distinto en cada ejecución. */
function awbPrueba(): string {
  const serie = 1_000_000 + (Date.now() % 8_000_000);
  return `999-${serie}${serie % 7}`;
}

async function abrirCargo(page: Page, id: number): Promise<void> {
  await page.goto(`/cargo/${id}`);
  await page.waitForTimeout(4000);
  await cerrarVelo(page);
}

const modalMawb = (page: Page) => page.locator(".v-overlay__content", { hasText: "Master Air Waybill" }).last();
const modalHawb = (page: Page) => page.locator(".v-overlay__content", { hasText: "House Air Waybills" }).last();

async function abrirMawb(page: Page) {
  await page.locator("button", { hasText: /MAWB/i }).first().click();
  const d = modalMawb(page);
  await expect(d).toBeVisible();
  return d;
}

async function esPdf(page: Page, accion: () => Promise<void>, patron: RegExp): Promise<void> {
  const resp = page.waitForResponse((r) => patron.test(r.url()), { timeout: 60_000 });
  await accion();
  const r = await resp;
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("application/pdf");
  // El cuerpo de la respuesta del clic lo consume el visor: se vuelve a pedir la misma URL y se valida el PDF.
  const pdf = await page.request.get(r.url(), { timeout: 60_000 }); // el PDF tarda 10-14 s en local
  const cuerpo = await pdf.body();
  expect(cuerpo.subarray(0, 4).toString()).toBe("%PDF");
  expect(cuerpo.length).toBeGreaterThan(5_000);
}

test.describe.serial("Cargo del partner: MAWB y HAWB", () => {
  test.setTimeout(150_000); // generar un PDF tarda 10-14 s y el test lo pide dos veces
  let cargo = 0;
  let express = 0;

  test.beforeAll(async ({ browser }) => {
    // Un cargo y una expedición courier propios de esta ejecución (no arrastran filas ni HAWB anteriores).
    const ctx = await browser.newContext({ storageState: ".auth/partner.json", ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    cargo = await crearBorrador(page, "cargo", "CGO-14");
    express = await crearBorrador(page, "courier", "SHP-02");
    await ctx.close();
  });

  test("CGO-14 · el número de MAWB se guarda, sobrevive a recargar y genera el PDF", async ({ page }) => {
    const numero = awbPrueba();
    await abrirCargo(page, cargo);
    let d = await abrirMawb(page);
    const campo = d.getByLabel("AWB Number");
    const guardado = page.waitForResponse((r) => r.request().method() === "PATCH" && /api_cargo_mawb/.test(r.url()));
    await campo.fill(numero);
    await campo.blur();
    expect((await guardado).status()).toBe(200);

    await page.reload();
    await page.waitForTimeout(4000);
    await cerrarVelo(page);
    d = await abrirMawb(page);
    await expect(d.getByLabel("AWB Number")).toHaveValue(numero);

    await d.getByText("DOCS & HAWB").click();
    await esPdf(page, () => d.getByText("MAWB", { exact: true }).last().click(), /api_awb_documents.*type=mawb/);
  });

  // P60 (resuelto en tmwe_api): al cambiar el número se rechaza con 422 lo que no es una referencia plausible
  // («abc») o un AWB IATA con dígito de control erróneo.
  test("CGO-14 · un AWB con formato o dígito de control inválido se rechaza al guardar", async ({ page }) => {
    await abrirCargo(page, cargo);
    const d = await abrirMawb(page);
    const campo = d.getByLabel("AWB Number");
    for (const [valor, mensaje] of [
      ["abc", /not a valid number or reference/],
      ["074-45686293", /invalid IATA check digit/],
    ] as const) {
      const resp = page.waitForResponse((r) => r.request().method() === "PATCH" && /api_cargo_mawb/.test(r.url()));
      await campo.fill(valor);
      await campo.blur();
      const r = await resp;
      expect(r.status(), valor).toBe(422);
      expect(await r.text()).toMatch(mensaje); // el BFF no reenvía el código, sí el detalle
      // El error debe verse: el almacén lo publica como aviso de error (role=alert). Con un aviso aún abierto el
      // siguiente no se muestra, por eso solo se exige el del primer valor.
      if (valor === "abc") await expect(page.getByRole("alert").filter({ hasText: mensaje })).toBeVisible({ timeout: 5000 });
    }
    // Deja un número válido para los siguientes tests.
    await campo.fill(awbPrueba());
    await campo.blur();
  });

  test("CGO-15 · alta manual de HAWB eligiendo la expedición, edición y PDF", async ({ page }) => {
    await abrirCargo(page, cargo);
    let d = await abrirMawb(page);
    await d.getByText("DOCS & HAWB").click();
    await d.getByRole("button", { name: /manage/i }).click();
    const lista = modalHawb(page);
    await expect(lista).toContainText(/No HAWB/i);

    await lista.getByRole("button", { name: /new hawb/i }).click();
    const campo = lista.locator(".v-autocomplete input").first();
    await campo.click();
    // Las expediciones de los clientes del partner no salen en la lista del API (P59): se teclea el número.
    await campo.pressSequentially(String(express), { delay: 30 });
    const alta = page.waitForResponse((r) => r.request().method() === "POST" && /api_cargo_hawb/.test(r.url()));
    await page.locator(".v-overlay--active .v-list-item", { hasText: String(express) }).first().click();
    const r = await alta;
    expect(r.status(), (await r.text()).slice(0, 200)).toBe(201);
    expect((await r.json()).id).toBeGreaterThan(0);

    // Se abre el formulario del HAWB: cada campo se guarda al salir de él.
    const form = page.locator(".v-overlay__content", { hasText: "Edit HAWB" }).last();
    await expect(form).toBeVisible();
    const campoYGuardar = async (campo: ReturnType<typeof form.getByLabel>, valor: string) => {
      const patch = page.waitForResponse((r) => r.request().method() === "PATCH" && /api_cargo_hawb/.test(r.url()));
      await campo.fill(valor);
      await campo.blur();
      const resp = await patch;
      expect(resp.status()).toBe(200);
      return resp.request().postDataJSON() as Record<string, unknown>;
    };
    // HALLAZGO 2026-11-01 (corregido): el evento `change` de Vuetify llegaba como Event y se enviaba
    // {"isTrusted":true,...}; el API guardaba «Array» y el peso se perdía.
    expect((await campoYGuardar(form.getByLabel("House weight (kg)"), "4.5")).peso_house).toBe(4.5);
    expect((await campoYGuardar(form.getByLabel("Goods description"), "Test goods")).goods_descr).toBe("Test goods");
    expect((await campoYGuardar(form.getByLabel("Name").first(), "QA Shipper BV")).shipper_nome).toBe("QA Shipper BV");

    // Lo guardado es lo tecleado (lectura directa del API, no de la pantalla).
    const guardado = await (await page.request.get(`/bff/v1/api_cargo_hawb?cargo_id=${cargo}`)).json();
    const casa = guardado.items.find((h: { id_spediz: string }) => Number(h.id_spediz) === express);
    expect(casa).toMatchObject({ peso_house: "4.50", goods_descr: "Test goods", shipper_nome: "QA Shipper BV" });
    await form.getByRole("button", { name: /close/i }).click();

    // El formulario sustituye al listado (un solo modal activo): se vuelve a abrir.
    await expect(form).toBeHidden();
    d = await abrirMawb(page);
    await d.getByText("DOCS & HAWB").click();
    await d.getByRole("button", { name: /manage/i }).click();
    // El listado muestra la expedición, el remitente y el peso, y el PDF se genera.
    await expect(modalHawb(page)).toContainText(`#${express}`);
    await expect(modalHawb(page)).toContainText("QA Shipper BV");
    await expect(modalHawb(page)).toContainText("4.50 kg");
    await esPdf(page, () => modalHawb(page).locator("button:has(.mdi-printer)").first().click(), /api_awb_documents.*type=hawb/);
  });

  test("CGO-15 · no se crea un segundo HAWB para la misma expedición", async ({ page }) => {
    await abrirCargo(page, cargo);
    const d = await abrirMawb(page);
    await d.getByText("DOCS & HAWB").click();
    await d.getByRole("button", { name: /manage/i }).click();
    const lista = modalHawb(page);
    await lista.getByRole("button", { name: /new hawb/i }).click();
    const campo = lista.locator(".v-autocomplete input").first();
    await campo.click();
    await campo.pressSequentially(String(express), { delay: 30 });
    const alta = page.waitForResponse((r) => r.request().method() === "POST" && /api_cargo_hawb/.test(r.url()));
    await page.locator(".v-overlay--active .v-list-item", { hasText: String(express) }).first().click();
    expect((await alta).status()).toBeGreaterThanOrEqual(400);
    await lista.getByRole("button", { name: /refresh/i }).click();
    await expect(lista.locator("tbody tr")).toHaveCount(1);
  });
});
