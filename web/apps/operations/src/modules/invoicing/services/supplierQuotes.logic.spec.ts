import { describe, expect, it } from "vitest";
import { quotesToSend } from "./supplierQuotes.logic";

describe("quotesToSend", () => {
  it("la cuota vacía por defecto (año actual, 0, 0) no viaja", () => {
    const y = new Date().getFullYear();
    expect(
      quotesToSend([{ anno: y, importo_netto: 0, id_piano_conto: 0 }]),
    ).toEqual([]);
  });
  it("conserva las cuotas reales y descarta solo la vacía", () => {
    const out = quotesToSend([
      { anno: 2026, importo_netto: 100, id_piano_conto: 5 },
      { anno: 2026, importo_netto: 0, id_piano_conto: 0 },
      { anno: 2026, importo_netto: 0, id_piano_conto: 7 },
    ]);
    expect(out).toEqual([
      { anno: 2026, importo_netto: 100, id_piano_conto: 5 },
      { anno: 2026, importo_netto: 0, id_piano_conto: 7 },
    ]);
  });
});
