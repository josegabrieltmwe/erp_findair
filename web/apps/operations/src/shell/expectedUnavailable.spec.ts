import { describe, expect, it } from "vitest";
import { isExpectedUnavailable } from "./expectedUnavailable";

describe("isExpectedUnavailable", () => {
  // Escenario: cuerpo real del BFF para un 503 de pasarela apagada (problem+json con el código en los tres sitios).
  it("reconoce el 503 PAYMENT_NOT_ACTIVE del BFF", () => {
    expect(
      isExpectedUnavailable({
        type: "urn:findair:bff:error:PAYMENT_NOT_ACTIVE",
        status: 503,
        code: "PAYMENT_NOT_ACTIVE",
        error_code: "PAYMENT_NOT_ACTIVE",
        error: { code: "PAYMENT_NOT_ACTIVE", message: "apagado" },
      }),
    ).toBe(true);
  });

  // Escenario: basta con que el código llegue por uno de los tres campos.
  it("acepta el código por cualquiera de sus campos y el de retorno sin configurar", () => {
    expect(isExpectedUnavailable({ error_code: "PAYMENT_NOT_ACTIVE" })).toBe(true);
    expect(isExpectedUnavailable({ error: { code: "PAYMENT_RETURN_URL_NOT_CONFIGURED" } })).toBe(true);
    expect(isExpectedUnavailable({ code: "PAYMENT_NOT_ACTIVE" })).toBe(true);
  });

  // Escenario: una avería de verdad (o un cuerpo ilegible) sigue avisando.
  it("no silencia otros 5xx ni cuerpos vacíos", () => {
    expect(isExpectedUnavailable({ code: "upstream_error", status: 502 })).toBe(false);
    expect(isExpectedUnavailable({ error: "Error interno" })).toBe(false);
    expect(isExpectedUnavailable({ error_code: "PAYMENT_PENDING_UNAVAILABLE" })).toBe(false);
    expect(isExpectedUnavailable(null)).toBe(false);
    expect(isExpectedUnavailable("PAYMENT_NOT_ACTIVE")).toBe(false);
    expect(isExpectedUnavailable(undefined)).toBe(false);
  });
});
