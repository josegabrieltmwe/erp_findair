import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Entorno node: se simula el mínimo de `window` que usa installBffFetch.
const calls: string[] = [];
const releasers: Array<() => void> = [];
const release = (): void => {
  releasers.splice(0).forEach((r) => r());
};

beforeEach(async () => {
  vi.resetModules();
  calls.length = 0;
  const fakeFetch = vi.fn((input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Promise<Response>((resolve) => {
      releasers.push(() => resolve(new Response("{}", { status: 200 })));
    });
  });
  (globalThis as unknown as { window: unknown }).window = {
    fetch: fakeFetch,
    location: { origin: "https://x.test", pathname: "/", search: "", hash: "", assign: vi.fn() },
    addEventListener: vi.fn(),
  };
  (globalThis as unknown as { fetch: unknown }).fetch = fakeFetch;
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

async function load() {
  const bff = await import("@tmwe/shared-frontend/http");
  bff.installBffFetch();
  bff.resetBusyForTests();
  return bff;
}

describe("indicador global de procesando", () => {
  it("se activa con un POST al BFF y se apaga al terminar", async () => {
    const bff = await load();
    const p = (window.fetch as typeof fetch)("/bff/v1/api_x", { method: "POST" });
    expect(bff.getBusyState().active).toBe(true);
    release();
    await p;
    expect(bff.getBusyState().active).toBe(false);
  });

  it("no se activa con GET, con X-Busy: off ni con rutas del copilot", async () => {
    const bff = await load();
    const f = window.fetch as typeof fetch;
    const reqs = [
      f("/bff/v1/api_x"),
      f("/bff/v1/api_x", { method: "POST", headers: { "X-Busy": "off" } }),
      f("/bff/v1/copilot_chat", { method: "POST" }),
    ];
    expect(bff.getBusyState().active).toBe(false);
    release();
    await Promise.allSettled(reqs);
  });

  it("el logout usa su texto, ignora el segundo clic y no se apaga", async () => {
    const bff = await load();
    const first = bff.bffLogout();
    void bff.bffLogout();
    expect(bff.getBusyState()).toEqual({ active: true, labelKey: "common.loggingOut" });
    expect(calls.filter((c) => c.includes("/auth/logout"))).toHaveLength(1);
    release();
    await first;
    expect(bff.getBusyState().active).toBe(true);
  });
});
