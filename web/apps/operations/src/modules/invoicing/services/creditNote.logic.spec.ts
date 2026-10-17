import { describe, expect, it } from "vitest";
import {
  buildCreditItems,
  capNet,
  creditErrors,
  creditLinesFrom,
  creditTotals,
  remainingIssues,
  vatOf,
  type CreditRemaining,
} from "./creditNote.logic";
import type { InvoiceLine } from "./invoice.service";

const dettagli: InvoiceLine[] = [
  { id: 1, tipo_record: "A", descriz: "Cliente", importo_netto: 0, importo_iva: 0, aliquota_iva: null, cod_iva: null },
  { id: 2, tipo_record: "C", descriz: "Envio 1", importo_netto: 100, importo_iva: 22, aliquota_iva: 22, cod_iva: "A1" },
  { id: 3, tipo_record: "M", descriz: "Envio 2", importo_netto: 33.33, importo_iva: 7.33, aliquota_iva: 22, cod_iva: "A1" },
  { id: 4, tipo_record: "F", descriz: "Fuel", importo_netto: 5, importo_iva: 1.1, aliquota_iva: 22, cod_iva: "A1" },
];

describe("creditNote.logic", () => {
  it("solo ofrece lineas C/M con neto positivo", () => {
    expect(creditLinesFrom(dettagli).map((l) => l.id)).toEqual([2, 3]);
  });

  it("redondea el IVA a 2 decimales", () => {
    expect(vatOf(33.33, 22)).toBe(7.33);
    expect(vatOf(10.05, 22)).toBe(2.21);
    expect(vatOf(100, null)).toBe(0);
  });

  it("acota el neto al tope de la linea", () => {
    expect(capNet(150, 100)).toBe(100);
    expect(capNet(-3, 100)).toBe(0);
    expect(capNet(Number.NaN, 100)).toBe(0);
    expect(capNet(40.456, 100)).toBe(40.46);
  });

  it("suma totales solo de las lineas elegidas", () => {
    const lines = creditLinesFrom(dettagli);
    lines[0].selected = true;
    lines[0].net = 50;
    lines[1].selected = true;
    expect(creditTotals(lines)).toEqual({ net: 83.33, vat: 18.33, gross: 101.66 });
  });

  it("valida seleccion e importes", () => {
    const lines = creditLinesFrom(dettagli);
    expect(creditErrors(lines)).toEqual(["none_selected"]);
    lines[0].selected = true;
    lines[0].net = 0;
    expect(creditErrors(lines)).toContain("net_zero");
    lines[0].net = 101;
    expect(creditErrors(lines)).toContain("net_over");
    lines[0].net = 100;
    expect(creditErrors(lines)).toEqual([]);
  });

  it("arma los items con el IVA de la linea", () => {
    const lines = creditLinesFrom(dettagli);
    lines[0].selected = true;
    lines[0].net = 40;
    expect(buildCreditItems(lines)).toEqual([
      { descriz: "Envio 1", importo_netto: 40, importo_iva: 8.8, aliquota_iva: 22, cod_iva: "A1" },
    ]);
  });

  it("sin tipo de IVA no envia IVA (lo resuelve el servidor)", () => {
    const lines = creditLinesFrom([
      { id: 9, tipo_record: "C", descriz: "X", importo_netto: 10, importo_iva: 0, aliquota_iva: null, cod_iva: null },
    ]);
    lines[0].selected = true;
    expect(buildCreditItems(lines)).toEqual([{ descriz: "X", importo_netto: 10 }]);
  });
});

describe("remainingIssues", () => {
  const rem: CreditRemaining = {
    original_netto: 100,
    original_iva: 22,
    credited_netto: 40,
    credited_iva: 8.8,
    remaining_netto: 60,
    remaining_iva: 13.2,
  };
  it("sin datos no bloquea", () => {
    expect(remainingIssues("partial", { net: 999, vat: 999 }, null)).toEqual([]);
  });
  it("parcial dentro de lo pendiente (y en el limite con tolerancia)", () => {
    expect(remainingIssues("partial", { net: 60, vat: 13.2 }, rem)).toEqual([]);
    expect(remainingIssues("partial", { net: 60.01, vat: 13.21 }, rem)).toEqual([]);
  });
  it("parcial que supera neto y/o IVA", () => {
    expect(remainingIssues("partial", { net: 60.02, vat: 1 }, rem)).toEqual(["net_over"]);
    expect(remainingIssues("partial", { net: 1, vat: 13.3 }, rem)).toEqual(["vat_over"]);
    expect(remainingIssues("partial", { net: 70, vat: 20 }, rem)).toEqual(["net_over", "vat_over"]);
  });
  it("total no mira los importes si queda neto", () => {
    expect(remainingIssues("full", { net: 0, vat: 0 }, rem)).toEqual([]);
  });
  it("totalmente acreditada bloquea total y parcial", () => {
    const done = { ...rem, credited_netto: 100, remaining_netto: 0, remaining_iva: 0 };
    expect(remainingIssues("full", { net: 0, vat: 0 }, done)).toEqual(["fully_credited"]);
    expect(remainingIssues("partial", { net: 1, vat: 0 }, done)).toEqual(["fully_credited"]);
  });
});
