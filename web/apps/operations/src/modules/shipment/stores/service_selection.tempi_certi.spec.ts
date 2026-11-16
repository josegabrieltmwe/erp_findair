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

const plain = { service_id: 1, description: "Express", available: true };
const withTc = {
  ...plain,
  tempi_certi: {
    cheapest: { idsrvfrnt: 1, fornitore_id: 3, price_total: 50 },
    variants: [{ idsrvfrnt: 2, fornitore_id: 5, price_total: 70 }],
  },
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("service_selection.store: tiempos garantizados (tempi_certi)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    listClient.mockReset();
  });

  it("no está activo por defecto y la carga normal no pide la opción", async () => {
    listClient.mockResolvedValue({
      success: true,
      data: { services: [plain] },
    });
    const s = useServiceSelectionStore();
    expect(s.tempiCertiActive).toBe(false);
    await s.loadClient(7, true);
    expect(listClient).toHaveBeenCalledWith(7, {
      include_unavailable: true,
      tempi_certi: false,
    });
    expect(s.tempiCertiActive).toBe(false);
    expect(s.clientListKey).toBe("7:std");
  });

  it("loadClientTempiCerti pide la opción, activa el estado y guarda meta.live_courier", async () => {
    listClient.mockResolvedValue({
      success: true,
      data: {
        services: [withTc],
        meta: { live_courier: { success: false, error: "timeout" } },
      },
    });
    const s = useServiceSelectionStore();
    await s.loadClientTempiCerti(7, true);
    expect(listClient).toHaveBeenCalledWith(7, {
      include_unavailable: true,
      tempi_certi: true,
    });
    expect(s.tempiCertiActive).toBe(true);
    expect(s.clientListKey).toBe("7:tc");
    expect(s.clientServices[0].tempi_certi?.variants).toHaveLength(1);
    expect(s.liveCourier?.success).toBe(false);
  });

  it("mantiene la lista anterior mientras llega la nueva y si falla", async () => {
    listClient.mockResolvedValueOnce({
      success: true,
      data: { services: [plain] },
    });
    const s = useServiceSelectionStore();
    await s.loadClient(7, true);

    const d = deferred<unknown>();
    listClient.mockReturnValueOnce(d.promise);
    const p = s.loadClientTempiCerti(7, true);
    expect(s.loadingClient).toBe(true);
    expect(s.clientServices).toEqual([plain]);
    d.resolve({ success: false, error: "boom" });
    await p;
    expect(s.clientServices).toEqual([plain]);
    expect(s.tempiCertiActive).toBe(false);
    expect(s.tempiCertiError).toBe("boom");
    expect(s.error).toBeNull();
    expect(s.loadingClient).toBe(false);
  });

  it("una excepción de red con la opción conserva la lista", async () => {
    listClient.mockResolvedValueOnce({
      success: true,
      data: { services: [plain] },
    });
    const s = useServiceSelectionStore();
    await s.loadClient(7, true);
    listClient.mockRejectedValueOnce(new Error("timeout"));
    await s.loadClientTempiCerti(7, true);
    expect(s.clientServices).toEqual([plain]);
    expect(s.tempiCertiError).toBe("timeout");
  });

  it("una carga normal posterior desactiva la opción (no persiste)", async () => {
    listClient.mockResolvedValue({
      success: true,
      data: { services: [withTc] },
    });
    const s = useServiceSelectionStore();
    await s.loadClientTempiCerti(7, true);
    expect(s.tempiCertiActive).toBe(true);
    listClient.mockResolvedValue({
      success: true,
      data: { services: [plain] },
    });
    await s.loadClient(7, true);
    expect(s.tempiCertiActive).toBe(false);
    expect(s.liveCourier).toBeNull();
    expect(s.clientListKey).toBe("7:std");
  });

  it("reset() y resetTempiCerti() apagan la opción e ignoran respuestas en vuelo", async () => {
    const d = deferred<unknown>();
    listClient.mockReturnValueOnce(d.promise);
    const s = useServiceSelectionStore();
    const p = s.loadClientTempiCerti(7, true);
    s.resetTempiCerti();
    d.resolve({ success: true, data: { services: [withTc] } });
    await p;
    expect(s.tempiCertiActive).toBe(false);
    expect(s.clientServices).toEqual([]);

    listClient.mockResolvedValue({
      success: true,
      data: { services: [withTc] },
    });
    await s.loadClientTempiCerti(7, true);
    s.reset();
    expect(s.tempiCertiActive).toBe(false);
    expect(s.clientListKey).toBeNull();
    expect(s.clientServices).toEqual([]);
  });
});
