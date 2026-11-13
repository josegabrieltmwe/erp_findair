import { describe, expect, it, vi } from "vitest";

// Los catalogos se cargan en diferido en la app: aqui se simula el plugin con
// una clave presente y las demas ausentes.
const TRANSLATED = new Set([
  "invoicing.errors.IVA_SIN_CAUSAL_SDI",
  "invoicing.errors.BILLING_DATE_REQUIRED",
  "invoicing.errors.BILLING_NO_PARTNER",
  "invoicing.errors.CLIENT_NOT_OWNED",
]);
vi.mock("../../../plugins/i18n", () => ({
  i18n: {
    global: {
      te: (k: string) => TRANSLATED.has(k),
      t: (k: string) => `traducido:${k}`,
    },
  },
}));

import { apiErrorText } from "./apiErrorText";

/** Collaudo 13/11 (S7): los 422 del backend llegaban como texto tecnico crudo. */
describe("apiErrorText", () => {
  it("un codigo desconocido o sin codigo devuelve el mensaje original", () => {
    expect(apiErrorText({ errorCode: "OTRO", message: "detalle" })).toBe("detalle");
    expect(apiErrorText({ message: "x" })).toBe("x");
    expect(apiErrorText(null)).toBe("");
  });

  it("un codigo conocido con frase se traduce", () => {
    expect(
      apiErrorText({ errorCode: "IVA_SIN_CAUSAL_SDI", message: "IVA_SIN_CAUSAL_SDI: raw" }),
    ).toBe("traducido:invoicing.errors.IVA_SIN_CAUSAL_SDI");
  });

  it("un codigo conocido sin frase en el catalogo cae al mensaje original", () => {
    expect(
      apiErrorText({ errorCode: "FISCAL_YEAR_CLOSED", message: "cerrado" }),
    ).toBe("cerrado");
  });

  // Collaudo 13/11, item 24: api_invoice_generate devolvia estos textos en
  // espanol sin codigo traducible.
  it("conoce los codigos nuevos de api_invoice_generate", () => {
    expect(apiErrorText({ errorCode: "BILLING_DATE_REQUIRED" })).not.toBe("");
    expect(apiErrorText({ errorCode: "BILLING_NO_PARTNER" })).not.toBe("");
    expect(apiErrorText({ errorCode: "CLIENT_NOT_OWNED" })).not.toBe("");
  });
});
