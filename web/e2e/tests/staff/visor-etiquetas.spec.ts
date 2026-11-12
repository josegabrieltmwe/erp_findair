import { test, expect, type Locator, type Page, type Request } from "@playwright/test";
import { credentials } from "../support/profiles";
import { cerrarVelo } from "../support/ui";

/**
 * Visor de etiquetas del courier (LabelViewer): una etiqueta cada vez, anterior/siguiente, teclado, ir al bulto,
 * y descargas/impresión que genera el servidor (PDF combinado y ZIP, con `packages`).
 *
 * NO escribe datos y NO reserva nada: necesita una expedición courier que YA tenga AWB (E2E_SHIPMENT_WITH_AWB=<id>)
 * y sustituye en el navegador las respuestas de etiquetas por datos fijos de 3 bultos, para que el resultado no
 * dependa de los ficheros reales ni de los workers de imagen. Lo que se comprueba es la SPA y las URLs que pide.
 * Supone la interfaz en inglés (idioma del usuario de pruebas).
 *
 * No cubre el diálogo «AWB generado» (AwbSuccessDialog): solo aparece tras reservar una AWB real, que esta prueba
 * no hace. Usa el mismo componente (LabelViewer), así que el comportamiento del visor queda cubierto aquí.
 */
const SHIPMENT = (process.env.E2E_SHIPMENT_WITH_AWB ?? "").trim();
const BULTOS = 3;

// PNG 1×1 válido: basta para que el <img> cargue y el visor marque la etiqueta como lista.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PDF_MIN = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
// Fin de directorio central de un ZIP vacío: suficiente para un binario `application/zip`.
const ZIP_VACIO = Buffer.from("504b0506000000000000000000000000000000000000", "hex");

test.beforeEach(() => {
  test.skip(!credentials("staff"), "faltan credenciales del personal interno (staff)");
  test.skip(!/^\d+$/.test(SHIPMENT), "falta E2E_SHIPMENT_WITH_AWB (id de una expedición courier con AWB)");
});

/** Peticiones a las rutas de descarga/impresión, para comprobar sus parámetros. */
function vigilarDescargas(page: Page): Request[] {
  const vistas: Request[] = [];
  page.on("request", (r) => {
    if (/\/bff\/v1\/api_label_combined_(pdf|zip)/.test(r.url())) vistas.push(r);
  });
  return vistas;
}

async function prepararMocks(page: Page): Promise<void> {
  // Sin diálogo de impresión real en el iframe oculto (printPdfFromUrl); el init script corre en todos los frames.
  await page.addInitScript(() => {
    window.print = () => {};
  });

  await page.route(/\/bff\/v1\/get_label_courier_shipment/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        labels: Array.from({ length: BULTOS }, (_, i) => ({
          is_label: true,
          package: i + 1,
          ext: "png",
          package_tracking: `TRK-E2E-000${i + 1}`,
          url: `https://api.invalid/erp/tmwe_json/get_label_file?shipment_id=${SHIPMENT}&package_number=${i + 1}`,
        })),
      }),
    }),
  );
  await page.route(/\/bff\/v1\/get_label_file/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 }),
  );
  await page.route(/\/bff\/v1\/api_label_combined_pdf/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: { "content-disposition": 'attachment; filename="labels.pdf"' },
      body: PDF_MIN,
    }),
  );
  await page.route(/\/bff\/v1\/api_label_combined_zip/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/zip",
      headers: { "content-disposition": 'attachment; filename="labels.zip"' },
      body: ZIP_VACIO,
    }),
  );
}

/** Abre la expedición, el menú de documentos y el diálogo de etiquetas del courier. */
async function abrirVisor(page: Page): Promise<Locator> {
  await prepararMocks(page);
  await page.goto(`/shipment/${SHIPMENT}`);
  await page.waitForTimeout(4000);
  await cerrarVelo(page);
  await page.getByRole("button", { name: "Documents" }).first().click();
  await page.getByText("View courier labels (AWB)").click();
  const visor = page.getByRole("group", { name: "Label viewer" });
  await expect(visor).toBeVisible();
  await expect(visor.locator(".lv__chip")).toHaveCount(BULTOS);
  return visor;
}

/** Entrada de un menú desplegable (Vuetify lo monta fuera del visor). */
const opcion = (page: Page, texto: string | RegExp) => page.locator(".v-list-item", { hasText: texto });
const titulo = (n: number) => new RegExp(`Label · package ${n}.*\\(${n} / ${BULTOS}\\)`);
const botonDescarga = (visor: Locator) => visor.getByRole("button", { name: /^Download$/ }).first();
const botonImprimir = (visor: Locator) => visor.getByRole("button", { name: /^Print$/ }).first();

test.describe("Visor de etiquetas del courier", () => {
  test.setTimeout(90_000);

  test("muestra una sola etiqueta y navega con las flechas y el teclado", async ({ page }) => {
    const visor = await abrirVisor(page);

    // Una sola imagen en pantalla (no una por bulto); el carril lista los 3 bultos sin cargar sus imágenes.
    await expect(visor.locator("img.lv__img")).toHaveCount(1);
    await expect(visor.locator(".lv__nav-title")).toContainText(titulo(1));
    await expect(visor.getByTitle("Previous package")).toBeDisabled();

    await visor.getByTitle("Next package").click();
    await expect(visor.locator(".lv__nav-title")).toContainText(titulo(2));
    await expect(visor.locator("img.lv__img")).toHaveCount(1);

    // Teclado: con el foco en el visor, → avanza hasta el último y ahí se deshabilita «siguiente».
    await visor.focus();
    await page.keyboard.press("ArrowRight");
    await expect(visor.locator(".lv__nav-title")).toContainText(titulo(3));
    await expect(visor.getByTitle("Next package")).toBeDisabled();

    await page.keyboard.press("ArrowLeft");
    await expect(visor.locator(".lv__nav-title")).toContainText(titulo(2));
  });

  test("el carril y «ir al bulto» saltan a un bulto concreto", async ({ page }) => {
    const visor = await abrirVisor(page);

    await visor.locator(".lv__chip", { hasText: "TRK-E2E-0003" }).click();
    await expect(visor.locator(".lv__nav-title")).toContainText(titulo(3));

    const ir = visor.getByLabel("Go to package");
    await ir.fill("1");
    await ir.press("Enter");
    await expect(visor.locator(".lv__nav-title")).toContainText(titulo(1));
  });

  test("el zoom se reinicia al cambiar de etiqueta", async ({ page }) => {
    const visor = await abrirVisor(page);

    await visor.getByTitle("Zoom in").click();
    await expect(visor.locator(".lv__zoom")).not.toHaveText("100%");
    await visor.getByTitle("Next package").click();
    await expect(visor.locator(".lv__zoom")).toHaveText("100%");
  });

  test("descarga el PDF de un bulto, el de todos y el ZIP con los parámetros correctos", async ({ page }) => {
    const peticiones = vigilarDescargas(page);
    const visor = await abrirVisor(page);

    // Este bulto (el 2): packages=2, sin disposition (es descarga).
    await visor.getByTitle("Next package").click();
    await botonDescarga(visor).click();
    await opcion(page, "This package").click();
    await expect.poll(() => peticiones.length).toBeGreaterThanOrEqual(1);
    let url = new URL(peticiones[peticiones.length - 1].url());
    expect(url.pathname).toMatch(/api_label_combined_pdf$/);
    expect(url.searchParams.get("shipment_id")).toBe(SHIPMENT);
    expect(url.searchParams.get("packages")).toBe("2");
    expect(url.searchParams.get("disposition")).toBeNull();

    // Todos en un PDF: sin `packages`.
    const antes = peticiones.length;
    await botonDescarga(visor).click();
    await opcion(page, "All in one PDF").click();
    await expect.poll(() => peticiones.length).toBeGreaterThan(antes);
    url = new URL(peticiones[peticiones.length - 1].url());
    expect(url.pathname).toMatch(/api_label_combined_pdf$/);
    expect(url.searchParams.get("packages")).toBeNull();

    // Todos en un ZIP: otra ruta, también sin `packages`.
    const antesZip = peticiones.length;
    await botonDescarga(visor).click();
    await opcion(page, "All in one ZIP").click();
    await expect.poll(() => peticiones.length).toBeGreaterThan(antesZip);
    url = new URL(peticiones[peticiones.length - 1].url());
    expect(url.pathname).toMatch(/api_label_combined_zip$/);
    expect(url.searchParams.get("shipment_id")).toBe(SHIPMENT);
    expect(url.searchParams.get("packages")).toBeNull();
  });

  test("un rango de bultos se manda como `packages` (1-2)", async ({ page }) => {
    const peticiones = vigilarDescargas(page);
    const visor = await abrirVisor(page);

    await botonDescarga(visor).click();
    await opcion(page, "Package range…").click();
    await visor.getByLabel("Packages (e.g. 1-5,8)").fill("1-2");
    await visor.locator("form.lv__range").getByRole("button", { name: "Download" }).click();

    await expect.poll(() => peticiones.length).toBeGreaterThanOrEqual(1);
    expect(new URL(peticiones[peticiones.length - 1].url()).searchParams.get("packages")).toBe("1-2");
  });

  test("un rango fuera de los bultos existentes avisa y no pide nada", async ({ page }) => {
    const peticiones = vigilarDescargas(page);
    const visor = await abrirVisor(page);

    await botonDescarga(visor).click();
    await opcion(page, "Package range…").click();
    await visor.getByLabel("Packages (e.g. 1-5,8)").fill("2-9");
    await visor.locator("form.lv__range").getByRole("button", { name: "Download" }).click();

    await expect(visor.getByText(`Packages go from 1 to ${BULTOS}`)).toBeVisible();
    expect(peticiones).toHaveLength(0);
  });

  test("imprimir pide el PDF del servidor en línea (inline) con el bulto actual", async ({ page }) => {
    const peticiones = vigilarDescargas(page);
    const visor = await abrirVisor(page);

    await visor.getByTitle("Next package").click();
    await botonImprimir(visor).click();
    await opcion(page, "This package").click();

    await expect.poll(() => peticiones.length).toBeGreaterThanOrEqual(1);
    const url = new URL(peticiones[peticiones.length - 1].url());
    expect(url.pathname).toMatch(/api_label_combined_pdf$/);
    expect(url.searchParams.get("packages")).toBe("2");
    expect(url.searchParams.get("disposition")).toBe("inline");
  });
});
