import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { useShipmentState } from "./useShipmentState";
import type { Shipment } from "../services/shipment.types";

// Campos que el servidor rechaza en una expedición facturada
// (Shipment_Constants::READONLY_FIELDS_INVOICED).
const SERVER_LOCKED = [
  "id_cliente", "id_sede", "RIF_cliente", "colli", "peso", "km_forza",
  "opz_par_doc", "contras_imp", "contras_incasso", "assicuraz_imp",
  "id_valuta_assic", "peso_fornit", "volume_cliente", "peso_fornit_reale",
  "dogana_imp", "id_valuta_dogana", "AWB_forn", "carico", "fuel_surc",
  "acc_fissa_corriere", "controllata", "checkforn", "id_fattura_p",
];

const make = (s: Partial<Shipment>) =>
  useShipmentState(ref(s as Shipment));

describe("useShipmentState.readonly", () => {
  it("bloquea todo lo que el servidor rechaza si está facturada con AWB", () => {
    const st = make({ id_fattura_a: "5", AWB_forn: "123" });
    for (const f of SERVER_LOCKED) {
      expect(st.readonly(f), f).toBe(true);
    }
  });

  it("sin factura no bloquea esos campos", () => {
    const st = make({ id_fattura_a: "0", AWB_forn: "123" });
    for (const f of ["km_forza", "peso_fornit_reale", "acc_fissa_corriere"]) {
      expect(st.readonly(f), f).toBe(false);
    }
  });

  it("usa readonly_fields del servidor (P57) además de las reglas locales", () => {
    const st = make({
      id_fattura_a: "0",
      readonly_fields: ["campo_nuevo_del_servidor"],
    } as Partial<Shipment>);
    expect(st.readonly("campo_nuevo_del_servidor")).toBe(true);
    expect(st.readonly("km_forza")).toBe(false);
  });

  it("sin readonly_fields en la respuesta no cambia nada", () => {
    const st = make({ id_fattura_a: "0" } as Partial<Shipment>);
    expect(st.readonly("campo_nuevo_del_servidor")).toBe(false);
  });
});
