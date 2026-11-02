import { describe, expect, it } from "vitest";
import { isSignedDecimal } from "@shared/listini/numeric";

describe("isSignedDecimal", () => {
  it("acepta enteros y decimales con signo", () => {
    for (const v of ["5", "-5", "1.25", "-0.5", "0"]) {
      expect(isSignedDecimal(v), v).toBe(true);
    }
  });
  it("rechaza lo que el servidor leería mal", () => {
    for (const v of ["--5", "1.2.3", ".5", "5.", "-", "1e3", "", "12345678901"]) {
      expect(isSignedDecimal(v), v).toBe(false);
    }
  });
});
