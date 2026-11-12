import { describe, expect, it, vi } from "vitest";

vi.mock("@shipment/plugins/i18n", () => ({ i18n: { global: { t: (k: string) => k } } }));
import { parseShipmentListQuery } from "@shipment/stores/shipment_list.store";
import { DEFAULT_SHIPMENT_QUEUE } from "./shipment-work-views";

describe("cola de trabajo por defecto del listado de expediciones", () => {
  it("es un tipo que el listado acepta (si no, normalisedType lo degradaría a «all» en silencio)", () => {
    expect(parseShipmentListQuery({ type: DEFAULT_SHIPMENT_QUEUE }).type).toBe(
      DEFAULT_SHIPMENT_QUEUE,
    );
  });

  it("un tipo inventado en la URL cae a «all», no llega al API", () => {
    expect(parseShipmentListQuery({ type: "x'; DROP TABLE" }).type).toBe("all");
  });
});
