import { expect, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";
import { cerrarVelo } from "./ui";

export const CLIENT = process.env.E2E_PARTNER_CLIENT ?? "";

/** Anota la URL de lo creado para que alguien lo anule/borre después (fuera de test-results, que se vacía). */
export function anotar(tipo: string, url: string): void {
  mkdirSync(".auth", { recursive: true });
  appendFileSync(".auth/ids-creados.txt", `${new Date().toISOString()} ${tipo} ${url}\n`);
}

export const botonCrear = (page: Page) => page.locator("button:has(.mdi-check)").last();

export async function elegirCliente(page: Page): Promise<void> {
  // El menú lateral puede reabrirse al hidratar la página: se cierra y se reintenta si el desplegable no sale.
  for (let intento = 1; intento <= 3; intento++) {
    await cerrarVelo(page);
    const input = page.getByLabel("Customer", { exact: true }).first();
    await input.click();
    await input.fill("");
    const busqueda = page.waitForResponse((r) => /api_anagrafica_crud/.test(r.url()), { timeout: 8000 }).catch(() => null);
    await input.pressSequentially(CLIENT, { delay: 40 });
    await busqueda;
    const opcion = page.locator(".v-overlay--active .v-list-item").first();
    if (await opcion.waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false)) {
      await opcion.click();
      return;
    }
  }
  throw new Error(`ningún cliente coincide con «${CLIENT}» tras 3 intentos`);
}

/** Crea un borrador (cargo o courier) con el cliente de pruebas y devuelve su ID numérico. */
export async function crearBorrador(page: Page, tipo: "cargo" | "courier", etiqueta: string): Promise<number> {
  await page.goto(tipo === "cargo" ? "/cargo/new" : "/shipment/new");
  await elegirCliente(page);
  await expect(botonCrear(page)).toBeEnabled();
  await botonCrear(page).click();
  await page.waitForURL(tipo === "cargo" ? /\/cargo\/\d+/ : /\/shipment\/\d+/, { timeout: 30_000 });
  anotar(etiqueta, page.url());
  return Number(/\/(\d+)(?:[/?#]|$)/.exec(new URL(page.url()).pathname + "/")?.[1]);
}
