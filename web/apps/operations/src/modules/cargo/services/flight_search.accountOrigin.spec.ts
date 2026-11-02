import { describe, expect, it } from "vitest";
import {
  isTmweAccountRate,
  normalizeRate,
  type FlightRate,
} from "./flight_search.service";

const base = (extra: Partial<FlightRate> = {}): FlightRate =>
  ({ airline_code: "KL", source: "realtime", short_id: "x1", ...extra }) as FlightRate;

describe("isTmweAccountRate", () => {
  it("es true solo cuando el backend declara account_origin = tmwe", () => {
    expect(isTmweAccountRate(base({ account_origin: "tmwe" }))).toBe(true);
    expect(isTmweAccountRate(base({ account_origin: "partner" }))).toBe(false);
  });

  it("no asume nada si el backend no lo declara", () => {
    expect(isTmweAccountRate(base())).toBe(false);
    expect(isTmweAccountRate(base({ account_fallback: true }))).toBe(false);
  });

  it("normalizeRate conserva account_origin y account_fallback", () => {
    const n = normalizeRate(base({ account_origin: "tmwe", account_fallback: true }));
    expect(isTmweAccountRate(n)).toBe(true);
    expect(n.account_fallback).toBe(true);
  });
});
