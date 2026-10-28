import { defineConfig, devices } from "@playwright/test";

/**
 * E2E de la UI (Vue + Vuetify) contra el BFF real. Plan: docs/pruebas/plan-de-pruebas-ui.md
 * Variables: E2E_BASE_URL, E2E_USER, E2E_PASS (ver web/e2e/README.md).
 */
export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./e2e/.results",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "e2e/report", open: "never" }],
    ["junit", { outputFile: "e2e/report/junit.xml" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://erp-findair.php8",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "es-ES",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
      testIgnore: /anon\.spec\.ts/,
    },
    { name: "anon", testMatch: /anon\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
  ],
});
