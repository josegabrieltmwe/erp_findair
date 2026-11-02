import { describe, expect, it } from "vitest";
import { currencyCodes, formatInvoiceAmount } from "./invoiceCurrency";

describe("invoiceCurrency (H10b)", () => {
  it("EUR siempre primero, sin duplicados ni siglas invalidas", () => {
    expect(currencyCodes([{ sigla: "usd" }, { sigla: "EUR" }, { sigla: "GBP" }, { sigla: "AAAA" }, { sigla: "" }])).toEqual([
      "EUR",
      "GBP",
      "USD",
    ]);
    expect(currencyCodes([])).toEqual(["EUR"]);
  });

  it("formatea con la moneda elegida", () => {
    expect(formatInvoiceAmount(1234.5, "USD")).toMatch(/USD$/);
    expect(formatInvoiceAmount(1, "")).toMatch(/EUR$/);
  });
});
