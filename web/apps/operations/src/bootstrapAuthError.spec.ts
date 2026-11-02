import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Ruta relativa: el symlink de node_modules de @tmwe/shared-frontend puede apuntar a otra copia del repo.
import { bootstrapBff } from "../../../packages/shared-frontend/src/http/bff";
import { authErrorFromSearch, authErrorMessage } from "../../../packages/shared-frontend/src/http/authError";

function setWindow(search: string, session: unknown) {
  const assign = vi.fn();
  const fetchMock = vi.fn(async () => ({ json: async () => session }) as unknown as Response);
  (globalThis as unknown as { window: unknown }).window = {
    location: { search, pathname: "/", hash: "", origin: "https://x", assign },
    fetch: fetchMock,
  };
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: () => "es" };
  return assign;
}

describe("bootstrapBff con ?auth_error= (H5)", () => {
  beforeEach(() => {
    delete (globalThis as unknown as { document?: unknown }).document;
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("sin sesion y con auth_error no redirige al login (sin bucle)", async () => {
    const assign = setWindow("?auth_error=invalid_state", { authenticated: false });
    expect(await bootstrapBff()).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it("sin sesion y sin auth_error si redirige al login", async () => {
    const assign = setWindow("", { authenticated: false });
    expect(await bootstrapBff()).toBe(false);
    expect(assign).toHaveBeenCalledTimes(1);
  });
});

describe("authError", () => {
  it("extrae y sanea el codigo", () => {
    expect(authErrorFromSearch("?auth_error=login_expired")).toBe("login_expired");
    expect(authErrorFromSearch("?x=1")).toBeNull();
    expect(authErrorFromSearch("?auth_error=%3Cscript%3E")).toBe("unknown");
  });

  it("mensaje por idioma, con generico para codigos desconocidos", () => {
    expect(authErrorMessage("invalid_state", "es-ES").title).toBe("No se pudo iniciar sesión");
    expect(authErrorMessage("zzz", "de").message).toBe("Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
    expect(authErrorMessage("zzz", "xx").retry).toBe("Try again");
  });
});
