import { describe, expect, it } from "vitest";
import {
  fieldKind,
  parseTierValue,
} from "@shared/anagrafiche/feature/scaglioniFieldValidation";

describe("fieldKind", () => {
  it("clasifica porcentajes y no negativos", () => {
    expect(fieldKind("pr01")).toBe("percent");
    expect(fieldKind("ass_perc")).toBe("percent");
    expect(fieldKind("fx02")).toBe("nonNegative");
    expect(fieldKind("kg03")).toBe("nonNegative");
    expect(fieldKind("ass_min")).toBe("nonNegative");
  });
});

describe("parseTierValue", () => {
  it("vacío o no numérico no se envía", () => {
    expect(parseTierValue("", "percent").ok).toBe(false);
    expect(parseTierValue("  ", "nonNegative").ok).toBe(false);
    expect(parseTierValue(null, "percent").ok).toBe(false);
    expect(parseTierValue("abc", "nonNegative").ok).toBe(false);
  });
  it("cero explícito es válido", () => {
    expect(parseTierValue("0", "percent")).toEqual({ ok: true, value: 0 });
  });
  it("rango de porcentaje 0-100", () => {
    expect(parseTierValue("100", "percent").ok).toBe(true);
    expect(parseTierValue("100.01", "percent").ok).toBe(false);
    expect(parseTierValue("-1", "percent").ok).toBe(false);
  });
  it("fijos >= 0 sin tope", () => {
    expect(parseTierValue("250.5", "nonNegative")).toEqual({ ok: true, value: 250.5 });
    expect(parseTierValue("-0.01", "nonNegative").ok).toBe(false);
  });
});
