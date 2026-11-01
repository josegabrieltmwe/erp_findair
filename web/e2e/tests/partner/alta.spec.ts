import { test, expect, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { credentials } from "../support/profiles";

/**
 * Alta de un cargo (CGO-01) y de una expedición courier (SHP-01) con un usuario PARTNER
 * (p. ej. 123Xpress Holanda). ESCRIBE datos reales en la base del API al que apunte E2E_BASE_URL.
 *
 * Seguro: no se ejecuta sin E2E_ALLOW_WRITE=1 y sin E2E_PARTNER_CLIENT (texto de búsqueda de un
 * cliente PROPIO del partner, p. ej. su razón social de pruebas, mínimo 2 caracteres).
 * No reserva vuelo, no genera AWB, no factura ni envía correos. Los IDs creados se anotan en
 * test-results/ids-creados.txt para que alguien los anule o los borre.
 */
const CLIENT = process.env.E2E_PARTNER_CLIENT ?? "";
const ALLOWED = process.env.E2E_ALLOW_WRITE === "1";

test.beforeEach(({}, info) => {
  test.skip(!credentials("partner"), "faltan E2E_PARTNER_USER / E2E_PARTNER_PASS");
  test.skip(!ALLOWED, "escribe datos: exige E2E_ALLOW_WRITE=1");
  test.skip(CLIENT.trim().length < 2, "falta E2E_PARTNER_CLIENT (cliente propio del partner, 2+ caracteres)");
  void info;
});

function anotar(tipo: string, url: string): void {
  mkdirSync("test-results", { recursive: true });
  appendFileSync("test-results/ids-creados.txt", `${new Date().toISOString()} ${tipo} ${url}\n`);
}

const crear = (page: Page) => page.locator("button:has(.mdi-check)").last();

async function elegirCliente(page: Page): Promise<void> {
  const input = page.locator(".v-autocomplete input").first();
  await input.fill(CLIENT);
  const opcion = page.locator(".v-overlay--active .v-list-item").first();
  await expect(opcion, `ningún cliente coincide con «${CLIENT}»`).toBeVisible();
  await opcion.click();
}

const CASOS = [
  { id: "CGO-01", titulo: "alta de cargo", ruta: "/cargo/new", post: /unified_cargo_shipment/, detalle: /\/cargo\/\d+/ },
  { id: "SHP-01", titulo: "alta de expedición courier", ruta: "/shipment/new", post: /unified_shipment(?!_)/, detalle: /\/shipment\/\d+/ },
];

for (const c of CASOS) {
  test.describe(`${c.id} · ${c.titulo} (partner)`, () => {
    test(`${c.id} · «Crear» deshabilitado sin cliente`, async ({ page }) => {
      await page.goto(c.ruta);
      await expect(crear(page)).toBeDisabled();
    });

    test(`${c.id} · una sola letra no lanza búsqueda`, async ({ page }) => {
      const busquedas: string[] = [];
      page.on("request", (r) => /anagrafic|client/i.test(r.url()) && r.method() === "GET" && busquedas.push(r.url()));
      await page.goto(c.ruta);
      await page.locator(".v-autocomplete input").first().fill("a");
      await page.waitForTimeout(800);
      expect(busquedas.filter((u) => /[?&]q=a(&|$)/.test(u))).toEqual([]);
      await expect(crear(page)).toBeDisabled();
    });

    test(`${c.id} · alta feliz y doble clic (un único POST)`, async ({ page }) => {
      const posts: { status: number; body: string }[] = [];
      page.on("response", async (r) => {
        if (r.request().method() === "POST" && c.post.test(r.url())) {
          posts.push({ status: r.status(), body: await r.text().catch(() => "") });
        }
      });
      await page.goto(c.ruta);
      await elegirCliente(page);
      await expect(crear(page)).toBeEnabled();
      await crear(page).dblclick(); // CGO-01-07 / SHP-01-09: no debe crear dos borradores
      await page.waitForURL(c.detalle, { timeout: 30_000 });
      anotar(c.id, page.url());
      expect(posts, "debe haber exactamente un POST de alta").toHaveLength(1);
      expect(posts[0].status, `respuesta: ${posts[0].body.slice(0, 200)}`).toBeLessThan(300);
      // El detalle carga sin error de permisos del partner.
      await expect(page.locator("body")).not.toContainText(/no autorizado|access_denied|403/i);
    });
  });
}
