import { describe, expect, it } from "vitest";
import { remainderOf, round2, validatePartialAmount } from "./collectModel";

describe("validatePartialAmount", () => {
  it("exige un importe", () => {
    expect(validatePartialAmount(null, 100)).toBe("required");
    expect(validatePartialAmount(undefined, 100)).toBe("required");
    expect(validatePartialAmount(Number.NaN, 100)).toBe("required");
  });
  it("rechaza cero y negativos", () => {
    expect(validatePartialAmount(0, 100)).toBe("not_positive");
    expect(validatePartialAmount(-5, 100)).toBe("not_positive");
  });
  it("rechaza importes iguales o superiores al total (sería un cobro total)", () => {
    expect(validatePartialAmount(100, 100)).toBe("exceeds");
    expect(validatePartialAmount(100.01, 100)).toBe("exceeds");
  });
  it("acepta un importe parcial válido", () => {
    expect(validatePartialAmount(40, 100)).toBeNull();
    expect(validatePartialAmount(99.99, 100)).toBeNull();
  });
});

describe("remainderOf", () => {
  it("calcula el resto con dos decimales", () => {
    expect(remainderOf(33.33, 100)).toBe(66.67);
    expect(remainderOf(0.1, 0.3)).toBe(0.2);
  });
  it("devuelve 0 si el importe no es parcial", () => {
    expect(remainderOf(100, 100)).toBe(0);
    expect(remainderOf(null, 100)).toBe(0);
    expect(round2(1.005)).toBe(1.01);
  });
});
