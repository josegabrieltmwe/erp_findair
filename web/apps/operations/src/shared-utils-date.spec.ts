import { describe, expect, it } from "vitest";
import { todayLocal } from "@shared/utils/date";

describe("todayLocal", () => {
  it("usa los campos locales, no UTC", () => {
    // 23:30 hora local del 31 de diciembre: en cualquier zona al este de UTC
    // toISOString() ya daría el día siguiente o el anterior según el desfase.
    expect(todayLocal(new Date(2026, 11, 31, 23, 30))).toBe("2026-12-31");
    expect(todayLocal(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });

  it("rellena mes y día con cero", () => {
    expect(todayLocal(new Date(2026, 2, 4, 12))).toBe("2026-03-04");
  });
});
