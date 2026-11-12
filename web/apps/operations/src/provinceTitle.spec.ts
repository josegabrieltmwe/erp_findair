import { describe, expect, it } from "vitest";
import { provinceTitle } from "@shared/anagrafiche/services/province.service";

describe("provinceTitle", () => {
  it("muestra sigla y nombre cuando la provincia tiene sigla", () => {
    expect(provinceTitle({ code: "MI", name: "Milano" })).toBe("MI — Milano");
  });

  it("no repite el nombre cuando el API lo manda como sigla", () => {
    expect(provinceTitle({ code: "Ontario", name: "Ontario" })).toBe("Ontario");
    expect(provinceTitle({ code: "ONTARIO", name: "Ontario" })).toBe("Ontario");
  });

  it("tolera nombre o sigla vacíos", () => {
    expect(provinceTitle({ code: "XY", name: "" })).toBe("XY");
    expect(provinceTitle({ code: "", name: "Lazio" })).toBe("Lazio");
  });
});
