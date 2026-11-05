import { describe, expect, it } from "vitest";
import { cleanAirport } from "./airport";

describe("cleanAirport", () => {
  it("descarta el centinela '0', vacíos y nulos", () => {
    expect(cleanAirport("0")).toBe("");
    expect(cleanAirport(0)).toBe("");
    expect(cleanAirport("")).toBe("");
    expect(cleanAirport(null)).toBe("");
    expect(cleanAirport(undefined)).toBe("");
  });
  it("conserva un código real", () => {
    expect(cleanAirport(" MXP ")).toBe("MXP");
  });
});
