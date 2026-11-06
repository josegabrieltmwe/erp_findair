import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Ruta relativa: el symlink de node_modules de @tmwe/shared-frontend puede apuntar a otra copia del repo.
import { bootstrapOtp, getOtpBootstrap, isOtpLandingPath } from "../../../packages/shared-frontend/src/http/otp";
import { isOtpMode, onOtpSessionLost, redirectToBffLogin, setOtpMode } from "../../../packages/shared-frontend/src/http/bff";

interface FakeResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function setup(search: string, responses: FakeResponse[]) {
  const assign = vi.fn();
  const replaceState = vi.fn();
  const queue = [...responses];
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("sin respuesta preparada");
    if (next.status === 0) throw new TypeError("network");
    return {
      status: next.status,
      json: async () => next.body ?? {},
      headers: { get: (n: string) => next.headers?.[n] ?? null },
    } as unknown as Response;
  });
  (globalThis as unknown as { window: unknown }).window = {
    location: { search, pathname: "/offer", hash: "", origin: "https://x", assign },
    history: { replaceState },
    fetch: fetchMock,
  };
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: () => "es" };
  return { assign, replaceState, fetchMock };
}

const AUTHORIZED = {
  authenticated: true,
  kind: "otp",
  csrf_token: "csrf-1",
  resource: { type: "cargo_offer", id: 12, state: "open" },
  scopes: ["view", "answer"],
};

describe("bootstrapOtp: el OTP del enlace autoriza el acceso, sin login", () => {
  beforeEach(() => {
    delete (globalThis as unknown as { document?: unknown }).document;
    (globalThis as unknown as { window?: unknown }).window = undefined;
    setOtpMode(false);
    onOtpSessionLost(null);
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
    setOtpMode(false);
    onOtpSessionLost(null);
  });

  it("lleva el tipo de recurso del enlace cuando lo trae y solo si tiene forma de tipo", async () => {
    const withType = setup("?id=12&otp=t0123&type=courier_offer", [{ status: 200, body: { ...AUTHORIZED, resource: { type: "courier_offer", id: 12, state: "open" } } }]);
    const ok = await bootstrapOtp();
    expect(JSON.parse(String(withType.fetchMock.mock.calls[0][1]?.body))).toEqual({ type: "courier_offer", id: "12", otp: "t0123" });
    expect(ok.ok && ok.resource.type).toBe("courier_offer");

    const weird = setup("?id=12&otp=AbC123&type=%3Cx%3E", [{ status: 200, body: AUTHORIZED }]);
    await bootstrapOtp();
    expect(JSON.parse(String(weird.fetchMock.mock.calls[0][1]?.body))).toEqual({ id: "12", otp: "AbC123" });
  });

  it("con id y otp los presenta al punto de autorización del BFF", async () => {
    const { fetchMock } = setup("?id=12&otp=AbC123", [{ status: 200, body: AUTHORIZED }]);

    const result = await bootstrapOtp();

    expect(result).toMatchObject({ ok: true, scopes: ["view", "answer"], csrf: "csrf-1", resource: { type: "cargo_offer", id: 12 } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/bff/auth/otp");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ id: "12", otp: "AbC123" });
    expect(getOtpBootstrap()).toBe(result);
  });

  it("tras autorizar quita el OTP de la barra y deja los globales sin usuario", async () => {
    const { replaceState } = setup("?id=12&otp=AbC123", [{ status: 200, body: AUTHORIZED }]);

    await bootstrapOtp();

    expect(replaceState).toHaveBeenCalledWith(null, "", "/offer");
    const w = window as unknown as { __TMWE_NAV__: { basePath: string }; __TMWE_OPERATIONS__: Record<string, unknown> };
    expect(w.__TMWE_NAV__.basePath).toBe("/bff/v1");
    expect(w.__TMWE_OPERATIONS__).toMatchObject({ csrf: "csrf-1", isTmwe: false, impersonating: false, partnerId: 0, capabilities: [], noAccess: false, otp: true });
    expect(isOtpMode()).toBe(true);
  });

  it("un OTP rechazado (403) es «invalid», también quita el OTP de la barra y NO va al login", async () => {
    const { assign, replaceState } = setup("?id=12&otp=mal", [{ status: 403, body: { code: "otp_not_authorized" } }]);

    expect(await bootstrapOtp()).toEqual({ ok: false, reason: "invalid" });
    expect(replaceState).toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("429: demasiados intentos, con el tiempo de espera", async () => {
    setup("?id=12&otp=AbC123", [{ status: 429, headers: { "Retry-After": "300" } }]);
    expect(await bootstrapOtp()).toEqual({ ok: false, reason: "locked", retryAfter: 300 });
  });

  it("409: hay una sesión de usuario abierta en este navegador", async () => {
    setup("?id=12&otp=AbC123", [{ status: 409 }]);
    expect((await bootstrapOtp())).toEqual({ ok: false, reason: "in_use" });
  });

  it("5xx o fallo de red: no se pudo comprobar, y el OTP se queda en la URL para reintentar", async () => {
    const a = setup("?id=12&otp=AbC123", [{ status: 503 }]);
    expect(await bootstrapOtp()).toEqual({ ok: false, reason: "unavailable" });
    expect(a.replaceState).not.toHaveBeenCalled();

    setup("?id=12&otp=AbC123", [{ status: 0 }]);
    expect(await bootstrapOtp()).toEqual({ ok: false, reason: "unavailable" });
  });

  it("una respuesta 200 sin sesión utilizable no autoriza", async () => {
    setup("?id=12&otp=AbC123", [{ status: 200, body: { authenticated: false } }]);
    expect(await bootstrapOtp()).toEqual({ ok: false, reason: "unavailable" });
  });

  it("sin OTP en la URL reanuda una sesión de OTP ya abierta (recarga)", async () => {
    const { fetchMock } = setup("", [{ status: 200, body: { ...AUTHORIZED, resource: { type: "cargo_offer", id: 12 } } }]);

    const result = await bootstrapOtp();

    expect(fetchMock.mock.calls[0][0]).toBe("/bff/auth/session");
    expect(result).toMatchObject({ ok: true, resource: { id: 12 }, csrf: "csrf-1" });
  });

  it("sin OTP y sin sesión de OTP: caducó, no se manda al login", async () => {
    const { assign } = setup("", [{ status: 200, body: { authenticated: false } }]);
    expect(await bootstrapOtp()).toEqual({ ok: false, reason: "expired" });
    expect(assign).not.toHaveBeenCalled();
  });

  it("una sesión de USUARIO no se toma por una de OTP", async () => {
    setup("", [{ status: 200, body: { authenticated: true, csrf_token: "c", user: { username: "ana" } } }]);
    expect(await bootstrapOtp()).toEqual({ ok: false, reason: "expired" });
  });

  it("en modo OTP, perder la sesión avisa a la vista y no redirige al login", () => {
    const { assign } = setup("", []);
    const lost = vi.fn();
    onOtpSessionLost(lost);
    setOtpMode(true);

    redirectToBffLogin();

    expect(lost).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it("fuera del modo OTP el login sigue funcionando como siempre", () => {
    const { assign } = setup("", []);
    setOtpMode(false);

    redirectToBffLogin();

    expect(assign).toHaveBeenCalledTimes(1);
  });
});

describe("isOtpLandingPath", () => {
  it("reconoce /offer (con o sin barra final) y nada más", () => {
    expect(isOtpLandingPath("/offer")).toBe(true);
    expect(isOtpLandingPath("/offer/")).toBe(true);
    expect(isOtpLandingPath("/")).toBe(false);
    expect(isOtpLandingPath("/offers")).toBe(false);
    expect(isOtpLandingPath("/cargo/offer")).toBe(false);
    expect(isOtpLandingPath("/home")).toBe(false);
  });
});
