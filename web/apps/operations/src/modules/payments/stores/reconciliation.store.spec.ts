import { describe, expect, it } from "vitest";
import {
  buildConfirmMatches,
  defaultAmount,
  isLineValid,
  type MatchLine,
} from "./reconciliation.store";
import type { MatchedItem } from "../types";

const item = (txAmount: number, importo: number): MatchedItem => ({
  transaction: {
    amount: txAmount,
    date: "2026-03-02T00:00:00",
    reference: "REF1",
    description: "x",
  },
  pagamento: { id: 11, importo } as MatchedItem["pagamento"],
});
const line = (it: MatchedItem, amount: number, accepted = true): MatchLine => ({
  key: "k",
  item: it,
  accepted,
  amount,
});

describe("conciliación", () => {
  it("el importe por defecto es el menor entre movimiento y cuota (en positivo)", () => {
    expect(defaultAmount(item(-80, 100))).toBe(80);
    expect(defaultAmount(item(150, 100))).toBe(100);
  });

  it("solo manda amount cuando es menor que la cuota (parcial)", () => {
    const m = buildConfirmMatches([
      line(item(100, 100), 100),
      line(
        {
          ...item(50, 100),
          pagamento: { id: 12, importo: 100 } as MatchedItem["pagamento"],
        },
        50,
      ),
      line(item(100, 100), 100, false),
    ]);
    expect(m).toHaveLength(2);
    expect(m[0]).toEqual({
      pagamento_id: 11,
      transaction_ref: "REF1",
      data_close: "2026-03-02",
    });
    expect(m[1].amount).toBe(50);
  });

  it("valida que el importe sea positivo y no supere la cuota", () => {
    expect(isLineValid(line(item(1, 100), 0))).toBe(false);
    expect(isLineValid(line(item(1, 100), 100.01))).toBe(false);
    expect(isLineValid(line(item(1, 100), 99.99))).toBe(true);
  });
});
