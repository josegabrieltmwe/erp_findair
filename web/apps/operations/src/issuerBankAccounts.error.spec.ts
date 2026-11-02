import { describe, expect, it } from "vitest";
import { errorText } from "@shared/issuer_bank_accounts/services/issuerBankAccounts.service";

describe("errorText (cuentas bancarias)", () => {
  it("devuelve el texto tal cual", () => {
    expect(errorText("nome o iban requerido")).toBe("nome o iban requerido");
  });
  it("extrae message de {code,message}, no «[object Object]»", () => {
    expect(errorText({ code: "ERROR", message: "IBAN no válido" })).toBe(
      "IBAN no válido",
    );
  });
  it("cae al code si no hay message", () => {
    expect(errorText({ code: "ERROR" })).toBe("ERROR");
  });
});
