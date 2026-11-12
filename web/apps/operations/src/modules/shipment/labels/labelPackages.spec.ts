import { describe, expect, it } from "vitest";
import {
  clampIndex,
  formatPackageSelection,
  neighborIndexes,
  packagesParam,
  parsePackageSelection,
  shortTracking,
} from "./labelPackages";

describe("parsePackageSelection", () => {
  it("lee listas y rangos, únicos y ordenados", () => {
    expect(parsePackageSelection("1-5,8")).toEqual({
      ok: true,
      packages: [1, 2, 3, 4, 5, 8],
    });
    expect(parsePackageSelection(" 7, 2 ,7 ")).toEqual({
      ok: true,
      packages: [2, 7],
    });
    expect(parsePackageSelection("3-3")).toEqual({ ok: true, packages: [3] });
  });

  it.each([["a"], ["0"], ["5-2"], ["1-"], ["-3"], ["1,,2"], ["1;DROP"]])(
    "rechaza %s",
    (spec) => {
      expect(parsePackageSelection(spec).ok).toBe(false);
    },
  );

  it("vacío tiene su motivo", () => {
    expect(parsePackageSelection("  ")).toEqual({ ok: false, reason: "empty" });
  });

  it("respeta el total de bultos", () => {
    expect(parsePackageSelection("1-4", 4).ok).toBe(true);
    expect(parsePackageSelection("1-5", 4)).toEqual({
      ok: false,
      reason: "out_of_range",
    });
  });

  it("acota rangos desmesurados", () => {
    expect(parsePackageSelection("1-999999999")).toEqual({
      ok: false,
      reason: "too_many",
    });
    expect(parsePackageSelection("1-500,501")).toEqual({
      ok: false,
      reason: "too_many",
    });
  });
});

describe("formatPackageSelection / packagesParam", () => {
  it("compacta en rangos", () => {
    expect(formatPackageSelection([1, 2, 3, 4, 5, 8])).toBe("1-5,8");
    expect(formatPackageSelection([8, 1, 1, 2])).toBe("1-2,8");
    expect(formatPackageSelection([])).toBe("");
  });
  it("ida y vuelta con el parser", () => {
    const sel = [2, 3, 4, 9, 11, 12];
    const r = parsePackageSelection(formatPackageSelection(sel));
    expect(r).toEqual({ ok: true, packages: sel });
  });
  it("todos = sin parámetro", () => {
    expect(
      packagesParam({ scope: "all", packages: null, format: "pdf" }),
    ).toBeUndefined();
    expect(
      packagesParam({ scope: "current", packages: [3], format: "pdf" }),
    ).toBe("3");
  });
});

describe("ayudas del carril", () => {
  it("acorta el tracking conservando el final", () => {
    expect(shortTracking("1Z999AA10123456784")).toHaveLength(14);
    expect(shortTracking("1Z999AA10123456784").endsWith("456784")).toBe(true);
    expect(shortTracking("ABC")).toBe("ABC");
    expect(shortTracking(null)).toBe("");
  });
  it("vecinos e índice acotado", () => {
    expect(neighborIndexes(0, 3)).toEqual([1]);
    expect(neighborIndexes(1, 3)).toEqual([2, 0]);
    expect(neighborIndexes(0, 1)).toEqual([]);
    expect(clampIndex(9, 3)).toBe(2);
    expect(clampIndex(-4, 3)).toBe(0);
    expect(clampIndex(5, 0)).toBe(0);
    expect(clampIndex(Number.NaN, 3)).toBe(0);
  });
});
