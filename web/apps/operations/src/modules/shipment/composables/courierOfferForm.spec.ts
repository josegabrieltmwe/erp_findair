import { describe, expect, it } from "vitest";
import { buildPayload, formFromView, mapServerFields, parseAmount, validateForm, type CourierQuoteForm } from "./courierOfferForm";

const ok = (over: Partial<CourierQuoteForm> = {}): CourierQuoteForm => ({
  costo: "120,50", currency: "USD", note: " ok ", schedule: "48h", confirmPrice: true, confirmTerms: true, ...over,
});

describe("formulario de respuesta del courier/partner", () => {
  it("interpreta coma o punto decimal y rechaza lo que no es un importe", () => {
    expect(parseAmount("120,5")).toBe(120.5);
    expect(parseAmount("120.50")).toBe(120.5);
    for (const bad of ["", "abc", "1.234,50", "-5", "12,345", "1e3"]) expect(parseAmount(bad)).toBeNull();
  });

  it("valida importe, divisa, longitudes y la doble confirmación", () => {
    expect(validateForm(ok())).toEqual({});
    expect(validateForm(ok({ costo: "0" })).costo).toBe("validation_amount");
    expect(validateForm(ok({ costo: "1000000" })).costo).toBe("validation_amount");
    expect(validateForm(ok({ currency: "EURO" })).currency).toBe("validation_currency");
    expect(validateForm(ok({ note: "x".repeat(4001) })).note).toBe("validation_too_long");
    expect(validateForm(ok({ schedule: "x".repeat(2001) })).schedule).toBe("validation_too_long");
    expect(validateForm(ok({ confirmTerms: false })).confirm).toBe("validation_confirm");
  });

  it("el payload lleva el importe numérico, los textos recortados y la confirmación", () => {
    expect(buildPayload(ok())).toEqual({
      costo: 120.5, change_valuta: "USD", txt_risposta: "ok", txt_schedule: "48h", confirm: { price: true, terms: true },
    });
  });

  it("arranca vacío, en la divisa de la solicitud si es válida y EUR si no", () => {
    expect(formFromView({ change_valuta: "gbp" }).currency).toBe("GBP");
    expect(formFromView({ change_valuta: "" }).currency).toBe("EUR");
    expect(formFromView({ change_valuta: null }).confirmPrice).toBe(false);
  });

  it("traduce los errores del servidor a los campos del formulario", () => {
    expect(mapServerFields({ costo: "invalid_amount", change_valuta: "invalid_currency", txt_risposta: "too_long" })).toEqual({
      costo: "validation_amount", currency: "validation_currency", note: "validation_too_long",
    });
    expect(mapServerFields(undefined)).toEqual({});
  });
});
