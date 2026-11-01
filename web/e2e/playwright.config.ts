import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de navegador contra la instalación LOCAL (vhost erp-findair.php8 → web/dist + bff/public).
 * La URL se cambia con E2E_BASE_URL (p. ej. https://sandbox.erp.findair.it para sandbox).
 * Los perfiles con credenciales (E2E_<PERFIL>_USER / E2E_<PERFIL>_PASS) se omiten si faltan;
 * el proyecto `anon` no necesita ninguna.
 */
const baseURL = process.env.E2E_BASE_URL ?? "https://erp-findair.php8";

const profile = (name: string, dir: string) => ({
  name,
  testDir: `./tests/${dir}`,
  dependencies: ["setup"],
  use: { ...devices["Desktop Chrome"], storageState: `.auth/${name}.json` },
});

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    // El certificado local (mkcert/autofirmado) no está en el almacén de Chromium.
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "anon", testDir: "./tests/anon", use: { ...devices["Desktop Chrome"] } },
    // `smoke` recorre todas las rutas; se ejecuta una vez por perfil.
    profile("staff", "smoke"),
    profile("partner", "smoke"),
    profile("sinacc", "smoke"),
  ],
});
