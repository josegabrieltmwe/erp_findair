import { describe, expect, it } from "vitest";
import { checkfornLabelKey, isCheckfornOk } from "./checkforn";

describe("checkforn (H17e)", () => {
  it("'OK' no es un valor del dominio", () => {
    expect(isCheckfornOk("OK")).toBe(false);
  });

  it("solo V se considera verificado; el resto, incluida A (abono recibido), no", () => {
    expect(isCheckfornOk("V")).toBe(true);
    expect(isCheckfornOk("v")).toBe(true);
    for (const v of ["O", "K", "X", "R", "A", "a", "", null, undefined, "?"]) {
      expect(isCheckfornOk(v)).toBe(false);
    }
  });

  it("clave i18n por valor", () => {
    expect(checkfornLabelKey("X")).toBe("shipment.checkforn.opt_x");
    expect(checkfornLabelKey("")).toBeNull();
    expect(checkfornLabelKey("OK")).toBeNull();
  });
});
