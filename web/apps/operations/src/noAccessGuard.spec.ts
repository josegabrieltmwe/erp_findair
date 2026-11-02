import { afterEach, describe, expect, it } from "vitest";
// Ruta relativa: el symlink de node_modules de @tmwe/shared-frontend puede apuntar a otra copia del repo.
import { bootstrapBff, hasErpAccess, sessionHasNoAccess } from "../../../packages/shared-frontend/src/http/bff";
import { noAccessMessage } from "../../../packages/shared-frontend/src/http/noAccess";

const staff = { user: { is_tmwe: true, capabilities_source: "backend" }, capabilities: ["tmwe", "clients"] };
const partner = { user: { is_tmwe: false, capabilities_source: "backend" }, capabilities: ["clients", "my_org"] };
const sinAcceso = { user: { is_tmwe: false, capabilities_source: "backend" }, capabilities: [] };
// Reserva del BFF (get_my_profile) o fallo al cargar el contexto: [] no significa «sin acceso».
const reservaPartner = { user: { is_tmwe: false }, capabilities: [] };
const contextoFallido = { user: {}, capabilities: [] };

describe("sessionHasNoAccess", () => {
  it("staff y partner con capacidades entran", () => {
    expect(sessionHasNoAccess(staff)).toBe(false);
    expect(sessionHasNoAccess(partner)).toBe(false);
  });
  it("solo bloquea cuando el API declara capacidades vacias", () => {
    expect(sessionHasNoAccess(sinAcceso)).toBe(true);
  });
  it("no bloquea a un partner con la deduccion de reserva ni ante un fallo de contexto", () => {
    expect(sessionHasNoAccess(reservaPartner)).toBe(false);
    expect(sessionHasNoAccess(contextoFallido)).toBe(false);
  });
  it("nunca bloquea a TMWE aunque vengan vacias", () => {
    expect(sessionHasNoAccess({ user: { is_tmwe: true, capabilities_source: "backend" }, capabilities: [] })).toBe(false);
  });
  it("sin sesion informada no bloquea", () => {
    expect(sessionHasNoAccess({})).toBe(false);
  });
});

describe("bootstrapBff + hasErpAccess", () => {
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  async function boot(extra: unknown) {
    const session = { authenticated: true, csrf_token: "t", ...(extra as object) };
    const fetchMock = async () => ({ json: async () => session }) as unknown as Response;
    (globalThis as unknown as { window: unknown }).window = {
      location: { search: "", pathname: "/", hash: "", origin: "https://x", assign: () => {} },
      fetch: fetchMock,
    };
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: () => "es" };
    expect(await bootstrapBff()).toBe(true);
  }

  it("sin acceso: hasErpAccess es false", async () => {
    await boot(sinAcceso);
    expect(hasErpAccess()).toBe(false);
  });
  it("staff y partner: hasErpAccess es true", async () => {
    await boot(staff);
    expect(hasErpAccess()).toBe(true);
    await boot(partner);
    expect(hasErpAccess()).toBe(true);
  });
});

describe("textos de la pantalla", () => {
  it("por idioma, con ingles por defecto, sin nombrar scopes ni endpoints", () => {
    expect(noAccessMessage("es-ES").logout).toBe("Cerrar sesión");
    expect(noAccessMessage("de").title).toContain("keinen Zugriff");
    expect(noAccessMessage("xx").logout).toBe("Sign out");
    for (const l of ["es", "en", "it", "nl", "de"]) {
      expect(noAccessMessage(l).message).not.toMatch(/scope|api_|capabilit/i);
    }
  });
});
