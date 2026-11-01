import { expect, type Page } from "@playwright/test";

/**
 * Con una sesión sin preferencia guardada el menú lateral arranca abierto y su velo (`.dsh-veil--on`)
 * intercepta los clics y tapa el formulario. Se cierra pulsando fuera del menú.
 */
export async function cerrarVelo(page: Page): Promise<void> {
  const velo = page.locator(".dsh-veil--on");
  // El velo aparece unos instantes después de hidratar: se espera a que asome o a que pase el plazo.
  await velo.first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  if ((await velo.count()) === 0) return;
  await velo.click({ position: { x: 900, y: 500 }, timeout: 3000 }).catch(() => {});
  await expect(velo).toHaveCount(0);
}
