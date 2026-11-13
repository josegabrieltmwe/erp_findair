import { describe, expect, it } from "vitest";
import { validateShipmentPatch } from "./shipmentRules";

// Traductor de prueba: devuelve la clave y el label, para comprobar que no hay texto fijo.
const t = (key: string, params?: Record<string, unknown>) =>
  params?.label ? `${key}|${params.label}` : key;

describe("validateShipmentPatch con claves i18n (H23)", () => {
  it("devuelve claves, no texto italiano", () => {
    const errors = validateShipmentPatch({ peso: -1, id_valuta_dogana: "EU" } as never, t);
    expect(errors).toEqual([
      "shipment.validation.negative|shipment.validation.fields.peso",
      "shipment.validation.currency_invalid|shipment.validation.fields.id_valuta_dogana",
    ]);
  });

  it("un valor no numerico", () => {
    expect(validateShipmentPatch({ peso: "abc" } as never, t)[0]).toMatch(/^shipment\.validation\.not_number/);
  });

  it("vacios y validos pasan", () => {
    expect(validateShipmentPatch({ peso: "", dogana_imp: "12,5", id_valuta_dogana: "EUR" } as never, t)).toEqual([]);
  });

  // Collaudo 13/11: carico=-10 y carico='abc' (→ 0) se guardaban sin error.
  it("precio y costes: negativos y texto se rechazan", () => {
    for (const k of ["carico", "fuel_surc", "fuel_surc_cst", "costo"]) {
      expect(validateShipmentPatch({ [k]: -10 } as never, t)[0]).toMatch(/^shipment\.validation\.negative/);
      expect(validateShipmentPatch({ [k]: "abc" } as never, t)[0]).toMatch(/^shipment\.validation\.not_number/);
      expect(validateShipmentPatch({ [k]: "12,5" } as never, t)).toEqual([]);
    }
  });

  it("colli: entero >= 0", () => {
    expect(validateShipmentPatch({ colli: "1.5" } as never, t)[0]).toMatch(/not_integer/);
    expect(validateShipmentPatch({ colli: -1 } as never, t)[0]).toMatch(/negative/);
    expect(validateShipmentPatch({ colli: "3" } as never, t)).toEqual([]);
  });

  it("data_sped1: fecha de calendario real", () => {
    for (const bad of ["2026-02-30", "abc", "30/02/2026", "2026-13-40"]) {
      expect(validateShipmentPatch({ data_sped1: bad } as never, t)[0]).toMatch(/invalid_date/);
    }
    for (const ok of ["2026-11-14", "14/11/2026", "2024-02-29", "", "0000-00-00"]) {
      expect(validateShipmentPatch({ data_sped1: ok } as never, t)).toEqual([]);
    }
  });
});
