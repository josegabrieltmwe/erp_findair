import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const listClient = vi.fn();
vi.mock("@shipment/services/service_selection.service", () => ({
  serviceSelectionService: {
    select: vi.fn(),
    listClient: (...a: unknown[]) => listClient(...a),
    listFornitore: vi.fn(),
    clear: vi.fn(),
  },
}));
vi.mock("@shipment/services/fornitori.service", () => ({
  fornitoriService: { setService: vi.fn() },
}));
vi.mock("@shipment/services/shipment.service", () => ({
  shipmentService: { load: vi.fn(), update: vi.fn() },
}));
vi.mock("@shipment/services/http", () => ({ http: {} }));
vi.mock("@shipment/plugins/i18n", () => ({
  i18n: { global: { t: (k: string) => k } },
}));

import { useServiceSelectionStore } from "./service_selection.store";

const dhl = { service_id: 1, description: "DHL", available: true, fornitore_id: 3 };
const fa = { service_id: 9, description: "FA", available: true, fornitore_id: 8705, currency: "USD" };

describe("service_selection.store: couriers tardíos (Forward Air)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    listClient.mockReset();
  });

  it("detecta el courier con TIMEOUT y al recargar fusiona por fornitore_id", async () => {
    listClient.mockResolvedValueOnce({
      success: true,
      data: { services: [dhl], meta: { live_courier: { errors: { forward_air: "TIMEOUT" } } } },
    });
    const s = useServiceSelectionStore();
    await s.loadClient(7);
    expect(s.lateCouriers).toEqual(["forward_air"]);

    listClient.mockResolvedValueOnce({ success: true, data: { services: [dhl, fa], meta: {} } });
    await s.loadLateCouriers(7);
    expect(s.clientServices.map((x) => x.fornitore_id)).toEqual([3, 8705]);
    expect(s.lateCouriers).toEqual([]);
  });

  it("sin errores no hay couriers tardíos", async () => {
    listClient.mockResolvedValueOnce({ success: true, data: { services: [dhl], meta: {} } });
    const s = useServiceSelectionStore();
    await s.loadClient(7);
    expect(s.lateCouriers).toEqual([]);
  });
});
