import { test, expect } from "@playwright/test";

// Casos AC-01, AC-02 (sin sesión) y AC-06 de docs/plan-pruebas-ui.md. No necesitan credenciales.

test("la sesión anónima no está autenticada y no filtra datos", async ({ request }) => {
  const res = await request.get("/bff/auth/session");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.authenticated).toBe(false);
  expect(body.csrf_token).toBeUndefined();
  expect(JSON.stringify(body)).not.toMatch(/access_token|refresh_token/);
});

test("el login redirige al API con PKCE S256 y fija la cookie de sesión endurecida", async ({ request, baseURL }) => {
  const res = await request.get("/bff/auth/login", { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const loc = new URL(res.headers()["location"]);
  expect(loc.searchParams.get("response_type")).toBe("code");
  expect(loc.searchParams.get("code_challenge_method")).toBe("S256");
  expect(loc.searchParams.get("code_challenge")).toBeTruthy();
  expect(loc.searchParams.get("state")).toBeTruthy();
  expect(loc.searchParams.get("redirect_uri")).toBe(`${baseURL}/bff/auth/callback`);

  const cookie = res.headersArray().find((h) => h.name.toLowerCase() === "set-cookie")?.value ?? "";
  expect(cookie).toMatch(/^__Host-sid=/);
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=Lax/i);
  expect(cookie).toMatch(/Secure/i);
});

test("el callback con state inválido vuelve a la SPA con auth_error y sin sesión", async ({ request }) => {
  const res = await request.get("/bff/auth/callback?code=x&state=invalido", { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()["location"]).toMatch(/auth_error=/);
});

test("el proxy rechaza llamadas sin sesión", async ({ request }) => {
  const res = await request.get("/bff/v1/get_my_profile");
  expect([401, 403]).toContain(res.status());
});

test("las escrituras sin token CSRF se rechazan", async ({ request }) => {
  const res = await request.post("/bff/v1/api_copilot_write_proposal", { data: {} });
  expect([401, 403]).toContain(res.status());
});

test("la SPA sin sesión termina en la pantalla de login del API", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/tmwe-api|\/auth|action=auth/, { timeout: 20_000 });
  await expect(page.locator("#oauth-login-username")).toBeVisible();
});
