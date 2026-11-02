import { describe, expect, it, vi } from "vitest";

// El store importa el plugin i18n, que carga bundles .json por alias de Vite: no hace falta aqui.
vi.mock("@shipment/plugins/i18n", () => ({ i18n: { global: { t: (k: string) => k } } }));
import {
  SHIPMENT_LIST_DEFAULTS,
  serializeShipmentListQuery,
  shipmentActiveFilterCount,
  type ShipmentListUrlState,
} from "./shipment_list.store";

describe("fechas limpiadas con la x de Vuetify (H17d)", () => {
  const cleared = {
    ...SHIPMENT_LIST_DEFAULTS,
    date_from: null,
    date_to: null,
  } as unknown as ShipmentListUrlState;

  it("no escribe date_from=null en la URL", () => {
    const q = serializeShipmentListQuery(cleared);
    expect(q).not.toHaveProperty("date_from");
    expect(q).not.toHaveProperty("date_to");
    expect(Object.values(q)).not.toContain("null");
  });

  it("no cuenta un filtro null como activo", () => {
    expect(shipmentActiveFilterCount(cleared)).toBe(shipmentActiveFilterCount(SHIPMENT_LIST_DEFAULTS));
  });

  it("sigue serializando una fecha real", () => {
    const q = serializeShipmentListQuery({ ...SHIPMENT_LIST_DEFAULTS, date_from: "2026-11-01" });
    expect(q.date_from).toBe("2026-11-01");
  });
});
