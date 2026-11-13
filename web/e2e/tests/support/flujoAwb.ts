import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { credentials, type Profile } from "./profiles";
import { cerrarVelo } from "./ui";
import { crearBorrador } from "./borradores";
import { K } from "./tiempos";

/**
 * Flujo COMPLETO de AWB hasta los PDF, para un perfil (staff = TMWE, partner = usuario de un partner):
 *   cargo → MAWB por pestañas (número, direcciones, mercancía, firma) → 2 HAWB con datos propios → consolidación →
 *   los 6 PDF que genera el servidor (mawb, hawb, manifest, pouch, mawb_colli, hawb_colli) comprobando el CONTENIDO
 *   con `pdftotext` → errores de un cargo sin MAWB/HAWB → descarga desde la interfaz.
 *
 * ESCRIBE datos (cargos y expediciones de prueba, anotados en .auth/ids-creados.txt): exige E2E_ALLOW_WRITE=1.
 * NO reserva vuelo, NO confirma el MAWB, NO transmite el e-AWB y NO envía correos.
 * Supone la interfaz en inglés. Con una red lenta se alargan los plazos con E2E_FACTOR_TIEMPO.
 */

/** Aviso del campo País cuando el bloque tiene nombre pero no país (MawbAddressBlock). */
const AVISO_PAIS = "Required to print this block on the AWB";
/** El aviso es nuevo (2026-11-13): solo se exige cuando la SPA probada ya lo lleva (E2E_AVISO_PAIS=1). */
const EXIGIR_AVISO_PAIS = process.env.E2E_AVISO_PAIS === "1";

/** AWB de pruebas con prefijo 999 y dígito de control válido (serie mod 7), distinto en cada ejecución. */
function awbPrueba(): string {
  const serie = 1_000_000 + (Date.now() % 8_000_000);
  return `999-${serie}${serie % 7}`;
}

/** Texto de un PDF (pdftotext, paquete poppler-utils). */
function textoPdf(pdf: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), "e2e-pdf-"));
  try {
    const f = join(dir, "doc.pdf");
    writeFileSync(f, pdf);
    return execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

interface Pdf {
  status: number;
  ms: number;
  cuerpo: Buffer;
  cabeceras: Record<string, string>;
  codigo: string | null;
}

type TipoDoc = "mawb" | "hawb" | "manifest" | "pouch" | "mawb_colli" | "hawb_colli";

export function registrarFlujoAwb(perfil: Profile): void {
  const etiqueta = perfil === "staff" ? "TMWE (staff)" : "partner";

  test.describe.serial(`Flujo completo de AWB hasta el PDF · ${etiqueta}`, () => {
    /** Motivo por el que no se puede ejecutar (null si todo está listo). */
    const motivoOmision = (): string | null =>
      !credentials(perfil)
        ? `faltan credenciales de ${perfil}`
        : process.env.E2E_ALLOW_WRITE !== "1"
          ? "escribe datos: exige E2E_ALLOW_WRITE=1"
          : (process.env.E2E_PARTNER_CLIENT ?? "").trim().length < 2
            ? "falta E2E_PARTNER_CLIENT"
            : null;

    test.beforeEach(() => {
      const m = motivoOmision();
      test.skip(m !== null, m ?? "");
    });

    let cargo = 0;
    let cargoVacio = 0; // sin MAWB ni HAWB: nunca se abre en la interfaz (abrir el MAWB lo crea)
    let exp1 = 0;
    let exp2 = 0;
    let hawb1 = 0;
    let hawb2 = 0;
    const awb = awbPrueba();
    const tiempos: string[] = [];

    const D = {
      mawb: {
        shipper: "QA MAWB SHIPPER BV",
        consignee: "QA MAWB CONSIGNEE LTD",
        // Sin país la plantilla del PDF NO imprime el bloque (format_master_party_html devuelve vacío).
        shipperAddr: { address: "1 TEST STREET", city: "AMSTERDAM", country: "NL" },
        consigneeAddr: { address: "2 SAMPLE ROAD", city: "BERLIN", country: "DE" },
        goods: "E2E MAWB GOODS",
        ssr: "E2E SSR NOTE",
      },
      h1: { shipper: "QA HOUSE ONE SHIPPER", country: "NL", goods: "E2E HOUSE ONE GOODS", peso: "4.5" },
      h2: { shipper: "QA HOUSE TWO SHIPPER", country: "BE", goods: "E2E HOUSE TWO GOODS", peso: "7.25" },
    };

    // ---------- utilidades ----------
    async function abrirCargo(page: Page, id: number): Promise<void> {
      await page.goto(`/cargo/${id}`);
      await page.waitForTimeout(3000 * K);
      // El sandbox responde a veces «Servicio no disponible» al cargar el cargo: la pantalla ofrece «Retry» y se reintenta.
      for (let intento = 1; intento <= 3; intento++) {
        const reintentar = page.getByRole("button", { name: /^retry$/i });
        if (!(await reintentar.isVisible().catch(() => false))) break;
        test.info().annotations.push({ type: "reintento", description: `El cargo ${id} no cargó (intento ${intento})` });
        await reintentar.click();
        await page.waitForTimeout(3000 * K);
      }
      await cerrarVelo(page);
    }
    const modalMawb = (page: Page) => page.locator(".v-overlay__content", { hasText: "Master Air Waybill" }).last();
    const modalHawb = (page: Page) => page.locator(".v-overlay__content", { hasText: "House Air Waybills" }).last();

    async function abrirMawb(page: Page) {
      await cerrarVelo(page);
      await page.locator("button", { hasText: /MAWB/i }).first().click({ timeout: 60_000 * K });
      const d = modalMawb(page);
      await expect(d).toBeVisible();
      await expect(d.getByRole("tab", { name: "Goods" })).toBeVisible({ timeout: 30_000 * K });
      return d;
    }

    /** Ejecuta `accion` y espera el PATCH del MAWB (debe ser 200). */
    async function guardarMawb(page: Page, accion: () => Promise<void>): Promise<void> {
      const resp = page.waitForResponse((r) => r.request().method() === "PATCH" && /api_cargo_mawb/.test(r.url()), {
        timeout: 30_000 * K,
      });
      await accion();
      const r = await resp;
      expect(r.status(), (await r.text()).slice(0, 200)).toBe(200);
    }

    /** Cabeceras de una petición que cambia estado hacia el BFF (token CSRF de la sesión). */
    async function cabecerasEscritura(page: Page): Promise<Record<string, string>> {
      const sesion = await (await page.request.get("/bff/auth/session")).json();
      // El BFF rechaza con 403 `origin_not_allowed` las escrituras sin cabecera Origin del propio sitio.
      const origen = new URL(process.env.E2E_BASE_URL ?? "https://erp-findair.php8").origin;
      return { "X-CSRF-Token": String(sesion.csrf_token), "Content-Type": "application/json", Origin: origen };
    }

    async function leerJson<T = Record<string, unknown>>(page: Page, ruta: string): Promise<T> {
      const r = await page.request.get(`/bff/v1/${ruta}`, { timeout: 60_000 * K });
      expect(r.status(), ruta).toBe(200);
      return (await r.json()) as T;
    }

    /** Pide un PDF al servidor tal como lo hace la SPA y mide cuánto tarda. */
    async function pedirPdf(page: Page, id: number, tipo: TipoDoc, awbId?: number): Promise<Pdf> {
      const q = new URLSearchParams({ cargo_id: String(id), type: tipo, format: "pdf" });
      if (awbId) q.set("awb_id", String(awbId));
      // El generador de PDF falla a veces con 502/503/504 (P62: el PDF del MAWB, de 16 páginas, es el más lento): se
      // reintenta hasta 3 veces y cada intento queda en el informe y en las anotaciones, para no ocultar el defecto.
      for (let intento = 1; ; intento++) {
        const t0 = Date.now();
        const r = await page.request.get(`/bff/v1/api_awb_documents?${q}`, { timeout: 170_000 });
        const cuerpo = await r.body();
        const ms = Date.now() - t0;
        let codigo: string | null = null;
        let idPeticion = "";
        if (r.status() !== 200) {
          try {
            const j = JSON.parse(cuerpo.toString()) as { code?: string; request_id?: string };
            codigo = j.code ?? null;
            idPeticion = j.request_id ?? ""; // para buscar el fallo en los logs del BFF y del API
          } catch {
            /* cuerpo que no es JSON */
          }
        }
        tiempos.push(
          `${tipo}${awbId ? `#${awbId}` : ""} cargo ${id}: ${r.status()} · ${ms} ms · ${cuerpo.length} bytes${idPeticion ? ` · request_id ${idPeticion}` : ""}${intento > 1 ? ` (intento ${intento})` : ""}`,
        );
        const transitorio = [502, 503, 504].includes(r.status());
        if (transitorio && intento < 3) {
          test.info().annotations.push({ type: "reintento", description: `${tipo}: HTTP ${r.status()} a los ${ms} ms (intento ${intento})` });
          continue;
        }
        return { status: r.status(), ms, cuerpo, cabeceras: r.headers(), codigo };
      }
    }

    function esPdfValido(p: Pdf): string {
      expect(p.status, `HTTP ${p.status} ${p.codigo ?? ""} (${p.ms} ms)`).toBe(200);
      expect(p.cabeceras["content-type"]).toContain("application/pdf");
      expect(p.cuerpo.subarray(0, 4).toString()).toBe("%PDF");
      expect(p.cuerpo.length).toBeGreaterThan(5_000);
      return textoPdf(p.cuerpo);
    }

    /** Alta manual de un HAWB tecleando la expedición, y edición de sus campos (cada uno se guarda al salir). */
    async function altaHawb(
      page: Page,
      express: number,
      datos: { shipper: string; country: string; goods: string; peso: string },
    ): Promise<number> {
      await abrirCargo(page, cargo);
      const d = await abrirMawb(page);
      await d.getByText("DOCS & HAWB").click();
      await d.getByRole("button", { name: /manage/i }).click();
      const lista = modalHawb(page);
      await expect(lista).toBeVisible();

      await lista.getByRole("button", { name: /new hawb/i }).click();
      const campo = lista.locator(".v-autocomplete input").first();
      await campo.click();
      // Las expediciones de los clientes del partner no salen en la lista del API (P59): se teclea el número. La búsqueda
      // de candidatos tarda 13 s o más y a veces responde 504 (entonces la SPA no ofrece nada): se reintenta.
      const opcion = page.locator(".v-overlay--active .v-list-item", { hasText: String(express) }).first();
      let ofrecida = false;
      for (let intento = 1; intento <= 3 && !ofrecida; intento++) {
        await campo.fill("");
        await campo.pressSequentially(String(express), { delay: 30 });
        ofrecida = await opcion.waitFor({ state: "visible", timeout: 45_000 * K }).then(() => true, () => false);
      }
      if (!ofrecida) {
        // La búsqueda de candidatos (unified_cargo_consolidation?attachable=1) tarda más que el límite del BFF y responde
        // 504: la SPA no ofrece nada. Se deja constancia y la casa se crea y rellena por el API para poder seguir con los PDF.
        test.info().annotations.push({
          type: "aviso",
          description: `La búsqueda de candidatos no ofreció la expedición ${express} (lenta o 504): HAWB creado por API`,
        });
        const h = await cabecerasEscritura(page);
        const c = await page.request.post(`/bff/v1/api_cargo_hawb?cargo_id=${cargo}`, {
          headers: h,
          data: { id_spediz: express },
          timeout: 90_000,
        });
        expect(c.status(), (await c.text()).slice(0, 200)).toBe(201);
        const idApi = Number((await c.json()).id);
        const p = await page.request.patch(`/bff/v1/api_cargo_hawb?cargo_id=${cargo}&hawb_id=${idApi}`, {
          headers: h,
          data: {
            peso_house: Number(datos.peso),
            goods_descr: datos.goods,
            shipper_nome: datos.shipper,
            shipper_paese: datos.country,
          },
          timeout: 90_000,
        });
        expect(p.status(), (await p.text()).slice(0, 200)).toBe(200);
        return idApi;
      }
      const alta = page.waitForResponse((r) => r.request().method() === "POST" && /api_cargo_hawb/.test(r.url()), {
        timeout: 60_000 * K,
      });
      await opcion.click();
      const r = await alta;
      expect(r.status(), (await r.text()).slice(0, 200)).toBe(201);
      const id = Number((await r.json()).id);
      expect(id).toBeGreaterThan(0);

      const form = page.locator(".v-overlay__content", { hasText: "Edit HAWB" }).last();
      await expect(form).toBeVisible({ timeout: 30_000 * K });
      const guardar = async (c: ReturnType<typeof form.getByLabel>, valor: string) => {
        const patch = page.waitForResponse((x) => x.request().method() === "PATCH" && /api_cargo_hawb/.test(x.url()), {
          timeout: 30_000 * K,
        });
        await c.fill(valor);
        await c.blur();
        expect((await patch).status()).toBe(200);
      };
      await guardar(form.getByLabel("House weight (kg)"), datos.peso);
      await guardar(form.getByLabel("Goods description"), datos.goods);
      await guardar(form.getByLabel("Name").first(), datos.shipper);
      // Sin país el PDF del HAWB no imprime el remitente.
      await guardar(form.getByLabel("Country", { exact: true }).first(), datos.country);
      await form.getByRole("button", { name: /close/i }).click();
      await expect(form).toBeHidden();
      return id;
    }

    // ---------- preparación ----------
    test.beforeAll(async ({ browser }) => {
      test.setTimeout(300_000);
      if (motivoOmision() !== null) return; // sin credenciales o sin permiso de escritura no se crea nada
      const ctx = await browser.newContext({ storageState: `.auth/${perfil}.json`, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      cargo = await crearBorrador(page, "cargo", "AWB-E2E");
      cargoVacio = await crearBorrador(page, "cargo", "AWB-E2E-VACIO");
      exp1 = await crearBorrador(page, "courier", "AWB-E2E-EXP1");
      exp2 = await crearBorrador(page, "courier", "AWB-E2E-EXP2");
      await ctx.close();
    });

    test.afterAll(() => {
      // Resumen de tiempos de generación: deja a la vista lo lento que es cada PDF.
      console.log(`\nPDF (${etiqueta}):\n  ${tiempos.join("\n  ")}`);
    });

    // ---------- 1. MAWB ----------
    test("MAWB · número, direcciones, mercancía y firma se guardan y persisten", async ({ page }) => {
      test.setTimeout(240_000);
      await abrirCargo(page, cargo);
      const d = await abrirMawb(page);

      const numero = d.getByLabel("AWB Number");
      await guardarMawb(page, async () => {
        await numero.fill(awb);
        await numero.blur();
      });

      // Direcciones: Shipper es el primer bloque y Consignee el segundo.
      await d.getByRole("tab", { name: "Addresses" }).click();
      const rellenarBloque = async (n: number, nombre: string, a: { address: string; city: string; country: string }) => {
        for (const [etiqueta, valor] of [
          ["Name", nombre],
          ["Address", a.address],
          ["City", a.city],
          ["Country", a.country],
        ] as const) {
          const campo = d.getByLabel(etiqueta, { exact: true }).nth(n);
          await guardarMawb(page, async () => {
            await campo.fill(valor);
            await campo.blur();
          });
          // Aviso del formulario: con nombre y sin país el PDF omitiría el bloque; al poner el país desaparece.
          if (EXIGIR_AVISO_PAIS && etiqueta === "Name") await expect(d.getByText(AVISO_PAIS)).toHaveCount(1);
          if (EXIGIR_AVISO_PAIS && etiqueta === "Country") await expect(d.getByText(AVISO_PAIS)).toHaveCount(0);
        }
      };
      await rellenarBloque(0, D.mawb.shipper, D.mawb.shipperAddr);
      await rellenarBloque(1, D.mawb.consignee, D.mawb.consigneeAddr);

      await d.getByRole("tab", { name: "Goods" }).click();
      await guardarMawb(page, async () => {
        const c = d.getByLabel("Goods description");
        await c.fill(D.mawb.goods);
        await c.blur();
      });
      await guardarMawb(page, async () => {
        const c = d.getByLabel("SSR");
        await c.fill(D.mawb.ssr);
        await c.blur();
      });

      // Lo guardado es lo tecleado: lectura directa del API, no de la pantalla.
      const m = await leerJson<Record<string, string>>(page, `api_cargo_mawb?cargo_id=${cargo}`);
      expect(m.awb_number).toBe(awb);
      expect(m.shipper_nome).toBe(D.mawb.shipper);
      expect(m.consignee_nome).toBe(D.mawb.consignee);
      expect(m.shipper_paese).toBe(D.mawb.shipperAddr.country);
      expect(m.consignee_paese).toBe(D.mawb.consigneeAddr.country);
      expect(m.goods_descr).toBe(D.mawb.goods);
      expect(m.SSR).toBe(D.mawb.ssr);
    });

    // ---------- 2. HAWB y consolidación ----------
    test("HAWB · dos casas con datos propios y consolidación del cargo", async ({ page }) => {
      test.setTimeout(420_000);
      hawb1 = await altaHawb(page, exp1, D.h1);
      hawb2 = await altaHawb(page, exp2, D.h2);
      expect(hawb2).not.toBe(hawb1);

      const lista = await leerJson<{ items: Array<Record<string, string>> }>(page, `api_cargo_hawb?cargo_id=${cargo}`);
      expect(lista.items).toHaveLength(2);
      const por = (id: number) => lista.items.find((h) => Number(h.id_spediz) === id)!;
      expect(por(exp1)).toMatchObject({ shipper_nome: D.h1.shipper, shipper_paese: D.h1.country, goods_descr: D.h1.goods });
      expect(Number(por(exp1).peso_house)).toBeCloseTo(4.5, 2);
      expect(por(exp2)).toMatchObject({ shipper_nome: D.h2.shipper, shipper_paese: D.h2.country, goods_descr: D.h2.goods });
      expect(Number(por(exp2).peso_house)).toBeCloseTo(7.25, 2);

      // La vista de consolidación del cargo ve las dos expediciones enlazadas.
      const cons = await leerJson<{ houses?: Array<Record<string, string>>; items?: Array<Record<string, string>> }>(
        page,
        `unified_cargo_consolidation?cargo_id=${cargo}`,
      );
      const casas = cons.houses ?? cons.items ?? [];
      expect(casas.map((h) => Number(h.id_spediz)).sort()).toEqual([exp1, exp2].sort());
    });

    // ---------- 3. PDF con contenido ----------
    test("PDF del MAWB: se genera y trae el número, el remitente y la mercancía", async ({ page }) => {
      test.setTimeout(540_000);
      const p = await pedirPdf(page, cargo, "mawb");
      const txt = esPdfValido(p);
      expect(txt).toContain(awb);
      expect(txt).toMatch(new RegExp(D.mawb.shipper, "i"));
      expect(txt).toMatch(new RegExp(D.mawb.shipperAddr.city, "i"));
      expect(txt).toMatch(new RegExp(D.mawb.consignee, "i"));
      expect(txt).toMatch(new RegExp(D.mawb.consigneeAddr.city, "i"));
      expect(txt).toMatch(new RegExp(D.mawb.goods, "i"));
      expect(txt).toMatch(new RegExp(D.mawb.ssr, "i"));
    });

    test("PDF del HAWB: el de una casa solo trae sus datos y el general trae las dos", async ({ page }) => {
      test.setTimeout(540_000);
      const una = await pedirPdf(page, cargo, "hawb", hawb1);
      const t1 = esPdfValido(una);
      expect(t1).toMatch(new RegExp(D.h1.shipper, "i"));
      expect(t1).not.toMatch(new RegExp(D.h2.shipper, "i"));
      // El nombre de fichero lleva el tipo y la expedición de la casa (si el BFF reenvía la cabecera).
      const cd = una.cabeceras["content-disposition"];
      if (cd) expect(cd).toMatch(new RegExp(`HAWB_.*${exp1}`));

      const todas = await pedirPdf(page, cargo, "hawb");
      const tt = esPdfValido(todas);
      expect(tt).toMatch(new RegExp(D.h1.shipper, "i"));
      expect(tt).toMatch(new RegExp(D.h2.shipper, "i"));
    });

    test("PDF de manifiesto, pouch y packing lists: válidos y con el AWB o las casas", async ({ page }) => {
      test.setTimeout(300_000);
      const manifest = esPdfValido(await pedirPdf(page, cargo, "manifest"));
      expect(manifest.trim().length).toBeGreaterThan(100);
      expect(manifest).toMatch(new RegExp(`${D.h1.shipper}|${D.h2.shipper}|${exp1}|${exp2}`, "i"));

      const pouch = esPdfValido(await pedirPdf(page, cargo, "pouch"));
      expect(pouch).toContain(awb);

      const mColli = esPdfValido(await pedirPdf(page, cargo, "mawb_colli"));
      expect(mColli.trim().length).toBeGreaterThan(50);

      const hColli = esPdfValido(await pedirPdf(page, cargo, "hawb_colli", hawb1));
      expect(hColli.trim().length).toBeGreaterThan(50);
    });

    // ---------- 4. Errores de un cargo sin documentos ----------
    for (const [tipo, codigo] of [
      ["mawb", "NO_MAWB"],
      ["hawb", "NO_HAWB"],
      ["manifest", "NO_HAWB"],
      ["hawb_colli", "NO_HAWB"],
      ["pouch", "NO_MAWB"],
      ["mawb_colli", "NO_MAWB"],
    ] as const) {
      test(`Sin documentos · ${tipo} da ${codigo} (422) y no genera PDF`, async ({ page }) => {
        const p = await pedirPdf(page, cargoVacio, tipo);
        expect(p.status).toBe(422);
        expect(p.codigo).toBe(codigo);
      });
    }

    // ---------- 5. Desde la interfaz ----------
    test("Interfaz · el botón POUCH de la barra de documentos descarga el PDF", async ({ page }) => {
      test.setTimeout(180_000);
      await abrirCargo(page, cargo);
      const d = await abrirMawb(page);
      await d.getByText("DOCS & HAWB").click();
      const descarga = page.waitForEvent("download", { timeout: 120_000 });
      await d.locator(".awb-doc-pdf", { hasText: /pouch/i }).click();
      const f = await descarga;
      // La SPA nombra el fichero con el tipo y el id del cargo (no con el AWB que sugiere el servidor).
      expect(f.suggestedFilename()).toBe(`POUCH_${cargo}.pdf`);
      const ruta = await f.path();
      expect(ruta).toBeTruthy();
    });
  });
}
