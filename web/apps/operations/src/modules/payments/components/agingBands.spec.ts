import { describe, expect, it } from "vitest";
import { agingBandQuery } from "./agingBands";

const today = new Date(2026, 9, 4); // 2026-10-04

describe("agingBandQuery", () => {
  it("0_30: vencido hasta 30 días e incluye lo no vencido (sin tope superior)", () => {
    expect(agingBandQuery("0_30", today)).toEqual({ scad_dal: "2026-09-04" });
  });
  it("31_60: rango cerrado", () => {
    expect(agingBandQuery("31_60", today)).toEqual({
      scad_dal: "2026-08-05",
      scad_al: "2026-09-03",
    });
  });
  it("61_90: rango cerrado", () => {
    expect(agingBandQuery("61_90", today)).toEqual({
      scad_dal: "2026-07-06",
      scad_al: "2026-08-04",
    });
  });
  it("90_plus: sin límite inferior", () => {
    expect(agingBandQuery("90_plus", today)).toEqual({
      scad_al: "2026-07-05",
    });
  });
});
