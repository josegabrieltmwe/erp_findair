import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));
vi.mock("@shared/tracking_statuses/services/trackingStatuses.service", () => ({
  trackingStatusesService: {
    list: vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: 7 }], pages: 2 })
      .mockResolvedValueOnce({ items: [{ id: 3 }], pages: 2 }),
  },
}));

import { warehouseApi } from "./warehouse.service";

beforeEach(() => {
  httpMock.mockReset();
  httpMock.mockResolvedValue({ success: true, data: {} });
});

const last = () => httpMock.mock.calls.at(-1)! as [string, Record<string, unknown>];

describe("warehouseApi", () => {
  it("lookup: GET sticker", async () => {
    await warehouseApi.lookup("ABC");
    expect(last()).toEqual(["/api_docpack_validation", { method: "GET", query: { sticker: "ABC" } }]);
  });

  it("pendingClients / pendingShipments: query de pendientes", async () => {
    httpMock.mockResolvedValueOnce({ success: true, data: { days: 14, clients: [{ id_cliente: 1 }] } });
    const r = await warehouseApi.pendingClients(14);
    expect(last()).toEqual(["/api_docpack_validation", { method: "GET", query: { pending: "clients", days: 14 } }]);
    expect(r.clients).toHaveLength(1);
    await warehouseApi.pendingClients();
    expect(last()[1]).toEqual({ method: "GET", query: { pending: "clients" } });
    const s = await warehouseApi.pendingShipments(9, 30);
    expect(last()[1]).toEqual({ method: "GET", query: { pending: "shipments", client_id: 9, days: 30 } });
    expect(s.shipments).toEqual([]);
  });

  it("weighParcel: PUT con dimensiones", async () => {
    await warehouseApi.weighParcel(5, { peso: 2, dim_a: 1, dim_l: 2, dim_p: 3 });
    expect(last()[0]).toBe("/api_docpack_parcels");
    expect(last()[1]).toMatchObject({
      method: "PUT",
      body: { id: 5, peso: 2, dim_a: 1, dim_l: 2, dim_p: 3 },
    });
  });

  it("weighDocument: batch_weigh con tipo D y sin medidas", async () => {
    await warehouseApi.weighDocument(5, { peso: 0.4 });
    expect(last()[1]).toMatchObject({
      method: "POST",
      body: { action: "batch_weigh", parcels: [{ id: 5, peso: 0.4, tipo: "D" }] },
    });
  });

  it("registerOrphan / associate / markPrinted", async () => {
    await warehouseApi.registerOrphan("S1", { peso: 1, dim_a: 1, dim_l: 1, dim_p: 1 });
    expect(last()[1]).toMatchObject({ body: { action: "register", sticker: "S1", peso: 1 } });
    await warehouseApi.associate(3, 9);
    expect(last()[1]).toMatchObject({ body: { action: "associate", orphan_id: 3, shipment_id: 9 } });
    await warehouseApi.markPrinted([1, 2]);
    expect(last()[1]).toMatchObject({ body: { action: "mark_printed", parcel_ids: [1, 2] } });
  });

  it("listOrphans: paginación y filtro opcional", async () => {
    httpMock.mockResolvedValue({ success: true, data: [{ id: 1 }], pagination: { total: 41 } });
    const r = await warehouseApi.listOrphans(2, 20, " AB ");
    expect(last()[1].query).toEqual({ orphans: 1, page: 2, per_page: 20, sticker_filter: "AB" });
    expect(r).toEqual({ items: [{ id: 1 }], total: 41 });
  });

  it("completenessByDate: status=incomplete solo si se pide", async () => {
    httpMock.mockResolvedValue({ success: true, data: [] });
    await warehouseApi.completenessByDate("2026-10-04");
    expect(last()[1].query).toEqual({ date: "2026-10-04" });
    await warehouseApi.completenessByDate("2026-10-04", true);
    expect(last()[1].query).toEqual({ date: "2026-10-04", status: "incomplete" });
  });

  it("carga del autista: assign, clear con confirm, lectura", async () => {
    await warehouseApi.assignDriver([4], 8);
    expect(last()[1]).toMatchObject({ body: { action: "assign_driver", parcel_ids: [4], driver_id: 8 } });
    await warehouseApi.clearDriverLoading(8, "2026-10-04");
    expect(last()[1]).toMatchObject({
      body: { action: "clear_driver_loading", driver_id: 8, date: "2026-10-04", confirm: true },
    });
    await warehouseApi.driverLoading(8, "2026-10-04");
    expect(last()[1].query).toEqual({ driver_id: 8, date: "2026-10-04" });
  });

  it("registerPod envía el cuerpo tal cual", async () => {
    const body = { ldv: "L1", esito: "7", data_consegna: "2026-10-04 10:00:00" };
    await warehouseApi.registerPod(body);
    expect(last()).toEqual(["/api_driver_pod", { method: "POST", body }]);
  });

  it("manifestHistory y generateBrt", async () => {
    httpMock.mockResolvedValue({ success: true, data: { items: [{ id: 1 }] } });
    await warehouseApi.manifestHistory({ date: "2026-10", carrier: " brt ", page: 1, perPage: 20 });
    expect(last()[1].query).toEqual({ date: "2026-10", carrier: "brt", page: 1, per_page: 20 });
    await warehouseApi.generateBrt([1, 2]);
    expect(last()).toEqual(["/api_brt_manifest", { method: "POST", body: { shipment_ids: [1, 2] } }]);
  });

  it("trackingStatuses recorre todas las páginas", async () => {
    const r = await warehouseApi.trackingStatuses();
    expect(r.map((s) => s.id)).toEqual([7, 3]);
  });
});
