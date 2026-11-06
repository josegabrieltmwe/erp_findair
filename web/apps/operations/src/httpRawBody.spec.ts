import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Ruta relativa: el symlink de node_modules de @tmwe/shared-frontend puede apuntar a otra copia del repo.
import { createHttpClient, isRawBody } from "../../../packages/shared-frontend/src/http/index";

describe("createHttpClient · cuerpos que el navegador codifica solo", () => {
  let seen: { contentType: string | null; body: unknown } | null = null;

  beforeEach(() => {
    seen = null;
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      seen = { contentType: new Headers(init?.headers).get("Content-Type"), body: init?.body };
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });
    (globalThis as unknown as { window: unknown }).window = { location: { origin: "https://x" }, fetch: globalThis.fetch };
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: () => "en" };
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  const client = () => createHttpClient({ basePath: () => "/bff/v1" });

  it("un objeto JSON sigue yendo como application/json", async () => {
    await client()("/x", { method: "POST", body: { a: 1 } });
    expect(seen?.contentType).toContain("application/json");
  });

  it("un FormData NO se marca como JSON: el navegador pone multipart con su boundary", async () => {
    const form = new FormData();
    form.append("file", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "rates.pdf");

    await client()("/x", { method: "POST", body: form });

    expect(seen?.contentType ?? "").not.toContain("application/json");
    expect(seen?.body).toBeInstanceOf(FormData);
  });

  it("reconoce los cuerpos crudos", () => {
    expect(isRawBody(new FormData())).toBe(true);
    expect(isRawBody(new Blob(["a"]))).toBe(true);
    expect(isRawBody(new URLSearchParams("a=1"))).toBe(true);
    expect(isRawBody(new Uint8Array(2))).toBe(true);
    expect(isRawBody({ a: 1 })).toBe(false);
    expect(isRawBody("texto")).toBe(false);
    expect(isRawBody(null)).toBe(false);
  });
});
