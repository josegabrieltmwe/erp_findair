import { describe, expect, it } from "vitest";
import {
  normalizeRate,
  sortRates,
  type FlightRate,
} from "@cargo/services/flight_search.service";

/**
 * Coste, margen y recargos a coste/venta para el staff (TMWE y partners con
 * coste visible). Salen del bloque `margin` y de los `surcharges` del reparto
 * moderno de la API (Rate_Pricing_Applier).
 */
const priced = (over: Partial<FlightRate> = {}): FlightRate =>
  ({
    short_id: "wc_1",
    airline_code: "LH",
    source: "realtime",
    client_price: { total: 1150 },
    total_charge: 1150,
    currency: "EUR",
    margin: {
      percent: 15,
      fixed: 150,
      delta_amount: 150,
      delta_percent: 15,
      type: "FIXED",
      value: 150,
      applied_tier: 3,
      level: "channel",
      supplier_total: 1000,
    },
    surcharges: [
      { code: "BASE", name: "Air freight", supplier_amount: "900.00", client_amount: "1035.00" },
      { code: "FSC", name: "Fuel", supplier_amount: "100.00", client_amount: "115.00" },
    ],
    ...over,
  }) as unknown as FlightRate;

describe("margen y coste de una tarifa (staff)", () => {
  it("toma coste y margen de la API, con la regla aplicada", () => {
    const n = normalizeRate(priced());
    expect(n._client_price_n).toBe(1150);
    expect(n._cost_known).toBe(true);
    expect(n._cost_n).toBe(1000);
    expect(n._margin_n).toBe(150);
    expect(n._margin_pct_n).toBe(15);
    expect([n._margin_type, n._margin_value_n, n._margin_tier, n._margin_level]).toEqual([
      "FIXED",
      150,
      3,
      "channel",
    ]);
  });

  it("recargos del reparto moderno: venta y coste (antes salian a 0)", () => {
    const n = normalizeRate(priced());
    expect(n._surcharges_n.map((s) => [s.code, s.amount, s.cost_amount])).toEqual([
      ["BASE", 1035, 900],
      ["FSC", 115, 100],
    ]);
  });

  it("sin coste de la API (nivel cliente) el precio no se pinta como coste", () => {
    const n = normalizeRate(
      priced({ margin: undefined, surcharges: [{ code: "FSC", amount: 115 }] } as never),
    );
    expect(n._cost_known).toBe(false);
    expect(n._margin_n).toBeNull();
    expect(n._surcharges_n[0].cost_amount).toBeNull();
  });

  it("ordena por margen y por coste", () => {
    const a = normalizeRate(priced({ short_id: "a" }));
    const b = normalizeRate(
      priced({
        short_id: "b",
        margin: { delta_amount: 300, delta_percent: 30, supplier_total: 900, level: "airline" },
      } as never),
    );
    const c = normalizeRate(priced({ short_id: "c", margin: undefined } as never));
    expect(sortRates([a, b, c], "margin").map((r) => r.short_id)).toEqual(["b", "a", "c"]);
    expect(sortRates([a, b, c], "cost").map((r) => r.short_id)).toEqual(["b", "a", "c"]);
  });
});
