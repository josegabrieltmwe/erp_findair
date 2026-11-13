import { test, expect, type Page } from "@playwright/test";
import { credentials, type Profile } from "./profiles";
import { crearBorrador } from "./borradores";

/**
 * Autorización del HAWB: `api_cargo_hawb` comprueba el acceso a `cargo_id` pero, al editar o borrar, actúa sobre
 * `hawb_id` sin comprobar que esa casa pertenezca a ese cargo (Cargo_Hawb_Crud_Controller::handle_update/handle_delete
 * → Awb_Service::update_awb/delete_awb, que filtran solo por id).
 *
 * La prueba usa SOLO datos propios: dos cargos creados por el propio usuario (A y B) y una casa en B. Pide editar y
 * borrar esa casa desde la URL del cargo A. Lo correcto es rechazarlo (403/404) y que la casa no cambie. No demuestra
 * por sí sola una fuga entre organizaciones (no hay un segundo usuario), pero sí que falta la comprobación de pertenencia,
 * que es lo que la permitiría.
 *
 * ESCRIBE datos de prueba (cargos y una expedición, anotados en .auth/ids-creados.txt): exige E2E_ALLOW_WRITE=1.
 */
export function registrarAutorizacionHawb(perfil: Profile): void {
  test.describe.serial(`Autorización del HAWB · ${perfil}`, () => {
    test.setTimeout(300_000);
    let cargoA = 0;
    let cargoB = 0;
    let expB = 0;
    let hawbB = 0;

    const motivo = (): string | null =>
      !credentials(perfil)
        ? `faltan credenciales de ${perfil}`
        : process.env.E2E_ALLOW_WRITE !== "1"
          ? "escribe datos: exige E2E_ALLOW_WRITE=1"
          : (process.env.E2E_PARTNER_CLIENT ?? "").trim().length < 2
            ? "falta E2E_PARTNER_CLIENT"
            : null;

    test.beforeEach(() => {
      const m = motivo();
      test.skip(m !== null, m ?? "");
    });

    /** Cabeceras de una petición que cambia estado hacia el BFF (token CSRF de la sesión). */
    async function cabeceras(page: Page): Promise<Record<string, string>> {
      const s = await (await page.request.get("/bff/auth/session")).json();
      // El BFF rechaza con 403 `origin_not_allowed` las escrituras sin cabecera Origin del propio sitio.
      const origen = new URL(process.env.E2E_BASE_URL ?? "https://erp-findair.php8").origin;
      return { "X-CSRF-Token": String(s.csrf_token), "Content-Type": "application/json", Origin: origen };
    }

    const casasDe = async (page: Page, cargo: number) =>
      ((await (await page.request.get(`/bff/v1/api_cargo_hawb?cargo_id=${cargo}`)).json()) as {
        items: Array<Record<string, string>>;
      }).items;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(300_000);
      if (motivo() !== null) return;
      const ctx = await browser.newContext({ storageState: `.auth/${perfil}.json`, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      cargoA = await crearBorrador(page, "cargo", "HAWB-AUTZ-A");
      cargoB = await crearBorrador(page, "cargo", "HAWB-AUTZ-B");
      expB = await crearBorrador(page, "courier", "HAWB-AUTZ-EXP");
      // La casa se crea directamente en el API (no es lo que se prueba), en el cargo B.
      const r = await page.request.post(`/bff/v1/api_cargo_hawb?cargo_id=${cargoB}`, {
        headers: await cabeceras(page),
        data: { id_spediz: expB, goods_descr: "ORIGINAL B" },
        timeout: 60_000,
      });
      expect(r.status(), (await r.text()).slice(0, 200)).toBe(201);
      hawbB = Number((await r.json()).id);
      await ctx.close();
    });

    test("editar una casa del cargo B desde la URL del cargo A se rechaza y no la cambia", async ({ page }) => {
      const r = await page.request.patch(`/bff/v1/api_cargo_hawb?cargo_id=${cargoA}&hawb_id=${hawbB}`, {
        headers: await cabeceras(page),
        data: { goods_descr: "CAMBIADA DESDE OTRO CARGO" },
        timeout: 60_000,
      });
      const estado = r.status();
      const casa = (await casasDe(page, cargoB)).find((h) => Number(h.id) === hawbB);
      test.info().annotations.push({ type: "resultado", description: `PATCH cruzado → HTTP ${estado}; goods_descr de B = «${casa?.goods_descr}»` });
      expect(estado, "debe rechazarse").toBeGreaterThanOrEqual(400);
      expect(casa?.goods_descr, "la casa de B no debe cambiar").toBe("ORIGINAL B");
    });

    test("borrar una casa del cargo B desde la URL del cargo A se rechaza y no la borra", async ({ page }) => {
      const r = await page.request.delete(`/bff/v1/api_cargo_hawb?cargo_id=${cargoA}&hawb_id=${hawbB}`, {
        headers: await cabeceras(page),
        data: { cargo_id: cargoA, hawb_id: hawbB },
        timeout: 60_000,
      });
      const estado = r.status();
      const sigue = (await casasDe(page, cargoB)).some((h) => Number(h.id) === hawbB);
      test.info().annotations.push({ type: "resultado", description: `DELETE cruzado → HTTP ${estado}; la casa de B ${sigue ? "sigue" : "ya no está"}` });
      expect(estado, "debe rechazarse").toBeGreaterThanOrEqual(400);
      expect(sigue, "la casa de B no debe borrarse").toBe(true);
    });
  });
}
