import { describe, expect, it } from "vitest";
import vectors from "./carrierOfferTotal.vectors.json";
import { computeOfferTotal, lineAmount, round2 } from "./carrierOfferTotal";

interface Vector {
  name: string;
  chargeable_weight: number;
  parcels: number;
  charges: Parameters<typeof computeOfferTotal>[0];
  expected: number;
}

describe("carrierOfferTotal · casos dorados compartidos con el servidor (tmwe_api · Cargo_Offer_Calculator)", () => {
  const cases = (vectors as { cases: Vector[] }).cases;

  it("hay casos", () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);
  });

  for (const c of cases) {
    it(c.name, () => {
      expect(computeOfferTotal(c.charges, c.chargeable_weight, c.parcels)).toBe(c.expected);
    });
  }
});

describe("carrierOfferTotal · redondeo canónico", () => {
  it("floor(x*100 + 0.5) / 100, igual que PHP", () => {
    expect(round2(1.005)).toBe(1);
    expect(round2(1.006)).toBe(1.01);
    expect(round2(0)).toBe(0);
  });

  it("una línea sin tipo conocido no suma", () => {
    expect(lineAmount({ type: "otro", costo_unit: 9 }, 10, 1)).toBe(0);
  });
});
