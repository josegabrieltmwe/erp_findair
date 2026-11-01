import { afterEach, describe, expect, it } from "vitest";
import { invoicingBootstrapFrom } from "@tmwe/shared-frontend/http";
import { can } from "./env";

const base = { basePath: "/bff/v1", language: "es", csrf: "t" };

function setWindow(inv: unknown) {
  (globalThis as unknown as { window: unknown }).window = { __TMWE_INVOICING__: inv };
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("invoicingBootstrapFrom", () => {
  it("sin capacidades en la sesión no inyecta nada", () => {
    expect(invoicingBootstrapFrom({ is_tmwe: true }, base)).toBeUndefined();
    expect(invoicingBootstrapFrom(undefined, base)).toBeUndefined();
  });

  it("traduce las capacidades del backend y solo acepta true literal", () => {
    const out = invoicingBootstrapFrom(
      { invoicing: { can_read: true, can_write: true, can_send: false } },
      base,
    ) as { audience: string; capabilities: Record<string, boolean> };
    expect(out.audience).toBe("operator");
    expect(out.capabilities).toEqual({
      canRead: true,
      canWrite: true,
      canSend: false,
      canExport: false,
      canAdminNumbering: false,
    });
  });
});

describe("warehouse can.write con la sesión del BFF", () => {
  it("se habilita cuando el backend concede can_write", () => {
    setWindow(invoicingBootstrapFrom({ invoicing: { can_read: true, can_write: true } }, base));
    expect(can.write()).toBe(true);
  });

  it("sigue en solo lectura cuando el backend no lo concede", () => {
    setWindow(invoicingBootstrapFrom({ invoicing: { can_read: true, can_write: false } }, base));
    expect(can.write()).toBe(false);
  });

  it("sin bootstrap conserva el valor por defecto (solo lectura)", () => {
    setWindow(undefined);
    expect(can.write()).toBe(false);
  });
});
