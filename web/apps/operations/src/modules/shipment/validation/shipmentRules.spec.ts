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
});
