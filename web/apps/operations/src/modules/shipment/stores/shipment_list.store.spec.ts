import { describe, expect, it, vi } from "vitest";

// El store importa el plugin i18n, que carga bundles .json por alias de Vite: no hace falta aqui.
vi.mock("@shipment/plugins/i18n", () => ({ i18n: { global: { t: (k: string) => k } } }));
import {
  SHIPMENT_LIST_DEFAULTS,
  buildShipmentListQuery,
  parseShipmentListQuery,
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

describe("tramos de cargo en el listado courier (cargo_leg)", () => {
  it("por defecto no se pide ningún tramo: solo courier puros", () => {
    expect(SHIPMENT_LIST_DEFAULTS.cargo_leg).toBe("");
    expect(buildShipmentListQuery(SHIPMENT_LIST_DEFAULTS)).not.toHaveProperty("cargo_leg", "pickup");
    expect(buildShipmentListQuery(SHIPMENT_LIST_DEFAULTS).cargo_leg).toBeUndefined();
    expect(serializeShipmentListQuery(SHIPMENT_LIST_DEFAULTS)).not.toHaveProperty("cargo_leg");
  });

  it("pickup y delivery viajan a la API y a la URL, y no cuentan como valor por defecto", () => {
    for (const leg of ["pickup", "delivery"] as const) {
      const s = { ...SHIPMENT_LIST_DEFAULTS, cargo_leg: leg };
      expect(buildShipmentListQuery(s).cargo_leg).toBe(leg);
      expect(serializeShipmentListQuery(s).cargo_leg).toBe(leg);
      expect(shipmentActiveFilterCount(s)).toBe(shipmentActiveFilterCount(SHIPMENT_LIST_DEFAULTS) + 1);
    }
  });

  it("la URL solo admite pickup o delivery; cualquier otro valor vuelve al defecto", () => {
    expect(parseShipmentListQuery({ cargo_leg: "pickup" }).cargo_leg).toBe("pickup");
    expect(parseShipmentListQuery({ cargo_leg: "delivery" }).cargo_leg).toBe("delivery");
    expect(parseShipmentListQuery({ cargo_leg: "todo" }).cargo_leg).toBe("");
    expect(parseShipmentListQuery({}).cargo_leg).toBe("");
  });
});
