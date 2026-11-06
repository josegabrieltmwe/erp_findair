import { describe, expect, it } from "vitest";
import { buildPayload, chargesWithForm, formFromView, liveTotal, mapServerFields, parseAmount, validateForm, type QuoteForm } from "./carrierOfferForm";
import type { CarrierOfferView } from "@cargo/services/carrier_offer.service";

function view(over: Partial<CarrierOfferView> = {}): CarrierOfferView {
  return {
    id: 12, state: "open", scopes: ["view", "answer"], expires_at: null, carrier: "KLM", requested_at: null, answered_at: null,
    request_note: "", currency: "USD", total: 570, chargeable_weight: 100,
    charges: [
      { id: 1, tipo: "P", type: "kg", code: "", nome: "peso al Kg", costo_unit: "5.50", costo_min: "50", costo_max: "9999999", costo_unitV: 0, costo_minV: 0, costo_maxV: 0 },
      { id: 2, tipo: "S", type: "fix", code: "AWB", nome: "AWB fee", costo_unit: "20", costo_min: "0", costo_max: "0", costo_unitV: 0, costo_minV: 0, costo_maxV: 0 },
    ],
    reply: { note: "", schedule: "", reference: "" },
    freight: { parcels_count: 2, weight: 30, volume: 0.2, departure: "FRA", arrival: "MXP", goods: "", pallets: false },
    parcels: [], files: [], own_files: [],
    ...over,
  } as CarrierOfferView;
}

function confirmed(form: QuoteForm): QuoteForm {
  return { ...form, confirmPrice: true, confirmTerms: true };
}

describe("carrierOfferForm · importes", () => {
  it("'' vale 0, admite coma y rechaza texto, negativos y lo que pasa del máximo", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("  ")).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount("5,5")).toBe(5.5);
    expect(parseAmount("5.5")).toBe(5.5);
    expect(parseAmount(7)).toBe(7);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-3")).toBeNull();
    expect(parseAmount("1e3")).toBeNull();
    expect(parseAmount("9999999")).toBe(9999999);
    expect(parseAmount("10000000")).toBeNull();
  });
});

describe("carrierOfferForm · el total en vivo es el del servidor", () => {
  it("sin tocar nada es el de TMWE: 100 kg × 5.50 + 20 fijo = 570", () => {
    const v = view();
    expect(liveTotal(v, formFromView(v))).toBe(570);
  });

  it("con el coste propio de la aerolínea: 100 × 6 = 600 + 25 = 625", () => {
    const v = view();
    const f = formFromView(v);
    f.lines[0].unit = "6";
    f.lines[1].unit = "25";
    expect(liveTotal(v, f)).toBe(625);
  });

  it("al cambiar el peso tasable", () => {
    const v = view();
    const f = formFromView(v);
    f.weight = "50";
    expect(liveTotal(v, f)).toBe(295);
  });

  it("un importe a medio teclear no rompe el total: cuenta 0", () => {
    const v = view();
    const f = formFromView(v);
    f.lines[0].unit = "6,";
    expect(Number.isFinite(liveTotal(v, f))).toBe(true);
  });

  it("parte de lo que la aerolínea ya respondió", () => {
    const v = view({ charges: [{ ...view().charges[0], costo_unitV: 7 }, view().charges[1]], chargeable_weight: 80 });
    const f = formFromView(v);
    expect(f.lines[0].unit).toBe("7");
    expect(f.lines[1].unit).toBe("");
    expect(f.weight).toBe("80");
  });

  it("chargesWithForm no toca las líneas originales", () => {
    const v = view();
    const f = formFromView(v);
    f.lines[0].unit = "9";
    chargesWithForm(v.charges, f);
    expect(v.charges[0].costo_unitV).toBe(0);
  });
});

describe("carrierOfferForm · validación", () => {
  it("se puede enviar un formulario correcto y confirmado", () => {
    expect(validateForm(confirmed(formFromView(view())))).toEqual({});
  });

  it("sin confirmar precio y condiciones no se envía", () => {
    expect(validateForm(formFromView(view()))).toEqual({ confirm: "validation_confirm" });
    expect(validateForm({ ...formFromView(view()), confirmPrice: true })).toEqual({ confirm: "validation_confirm" });
  });

  it("señala el campo exacto", () => {
    const f = confirmed(formFromView(view()));
    f.lines[1].max = "mucho";
    f.weight = "0";
    f.note = "a".repeat(4001);
    f.reference = "b".repeat(101);
    expect(validateForm(f)).toEqual({
      "lines.1.max": "validation_amount",
      weight: "validation_weight",
      note: "validation_too_long",
      reference: "validation_too_long",
    });
  });
});

describe("carrierOfferForm · cuerpo del envío", () => {
  it("lleva importes y textos pero NUNCA un total", () => {
    const f = confirmed(formFromView(view()));
    f.lines[0].unit = "6";
    f.note = "Valid 7 days";
    const body = buildPayload(f);
    expect(body).toEqual({
      lines: [
        { id: 1, costo_unitV: 6, costo_minV: 0, costo_maxV: 0 },
        { id: 2, costo_unitV: 0, costo_minV: 0, costo_maxV: 0 },
      ],
      chargeable_weight: 100,
      note: "Valid 7 days",
      schedule: "",
      reference: "",
      confirm: { price: true, terms: true },
    });
    expect(JSON.stringify(body)).not.toMatch(/total|costo"/);
  });
});

describe("carrierOfferForm · errores del servidor", () => {
  it("los pasa a campos del formulario", () => {
    expect(
      mapServerFields({
        "lines.0.costo_unitV": "invalid_amount",
        "lines.2.costo_maxV": "invalid_amount",
        "lines.1.id": "unknown_line",
        chargeable_weight: "invalid_weight",
        note: "too_long",
        total: "too_large",
      }),
    ).toEqual({
      "lines.0.unit": "validation_amount",
      "lines.2.max": "validation_amount",
      "lines.1.unit": "validation_unknown_line",
      weight: "validation_weight",
      note: "validation_too_long",
      total: "validation_total",
    });
    expect(mapServerFields(undefined)).toEqual({});
  });
});
