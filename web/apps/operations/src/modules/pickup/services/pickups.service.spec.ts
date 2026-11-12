import { beforeEach, describe, expect, it, vi } from "vitest";

/** Servicio de ritiri: rutas, parámetros y cuerpos del contrato (docs/contrato-con-api.md). */
const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let replies: unknown[] = [];
let failWith: Error | null = null;

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    if (failWith) throw failWith;
    return replies.length > 1 ? replies.shift() : replies[0];
  }),
}));

import { buildListQuery, pickupsService } from "./pickups.service";

beforeEach(() => {
  calls.length = 0;
  replies = [{ success: true, data: {} }];
  failWith = null;
});

describe("buildListQuery", () => {
  it("solo envía los filtros informados", () => {
    expect(buildListQuery({}, 1, 25)).toEqual({ page: "1", per_page: "25" });
    expect(
      buildListQuery(
        {
          affidata: "N",
          presa_fissa: "R",
          data: "2030-03-06",
          data_da: "2030-03-01",
          id_sede: 4,
          id_contatti: 0,
        },
        2,
        50,
      ),
    ).toEqual({
      page: "2",
      per_page: "50",
      affidata: "N",
      presa_fissa: "R",
      data: "2030-03-06",
      data_da: "2030-03-01",
      id_sede: "4",
    });
  });
});

describe("pickupsService", () => {
  it("list pide api_pickups_crud con los filtros de la cola", async () => {
    replies = [{ success: true, data: [], pagination: { total: 3 } }];
    const res = await pickupsService.list(
      { affidata: "S", data: "2030-03-06" },
      1,
      1,
    );
    expect(calls[0]).toMatchObject({
      url: "/api_pickups_crud",
      opts: {
        method: "GET",
        query: { page: "1", per_page: "1", affidata: "S", data: "2030-03-06" },
      },
    });
    expect(res.pagination.total).toBe(3);
  });

  it("remove usa DELETE con el id (el API convierte una fija en R)", async () => {
    await pickupsService.remove(42);
    expect(calls[0]).toMatchObject({
      url: "/api_pickups_crud",
      opts: { method: "DELETE", query: { id: "42" } },
    });
  });

  it("propaga el error del API sin tragarlo", async () => {
    failWith = new Error("Pickup not found");
    await expect(pickupsService.remove(1)).rejects.toThrow("Pickup not found");
  });

  it("calendar envía driver_id solo si hay autista", async () => {
    await pickupsService.calendar("2030-03-01", "2030-03-31");
    await pickupsService.calendar("2030-03-01", "2030-03-31", 9);
    expect(calls[0].opts.query).toEqual({
      date_from: "2030-03-01",
      date_to: "2030-03-31",
    });
    expect(calls[1].opts.query).toEqual({
      date_from: "2030-03-01",
      date_to: "2030-03-31",
      driver_id: "9",
    });
  });

  it("assignMany manda pickup_ids[] y driver_id y devuelve el resultado por presa", async () => {
    const data = {
      assigned: 1,
      failed: 1,
      results: [
        { pickup_id: 1, ok: true, error: null },
        { pickup_id: 2, ok: false, error: "Pickup not found" },
      ],
    };
    replies = [{ success: true, data }];
    const res = await pickupsService.assignMany([1, 2], 55);
    expect(calls[0]).toMatchObject({
      url: "/api_pickup_driver_assignment",
      opts: { method: "POST", body: { pickup_ids: [1, 2], driver_id: 55 } },
    });
    expect(res).toEqual(data);
  });

  it("assignMany parte en lotes de 200 y suma los resultados", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => i + 1);
    replies = [
      { success: true, data: { assigned: 200, failed: 0, results: [] } },
      {
        success: true,
        data: {
          assigned: 49,
          failed: 1,
          results: [{ pickup_id: 250, ok: false, error: "x" }],
        },
      },
    ];
    const res = await pickupsService.assignMany(ids, 5);
    expect(calls).toHaveLength(2);
    expect(
      (calls[0].opts.body as { pickup_ids: number[] }).pickup_ids,
    ).toHaveLength(200);
    expect(
      (calls[1].opts.body as { pickup_ids: number[] }).pickup_ids,
    ).toHaveLength(50);
    expect(res).toMatchObject({ assigned: 249, failed: 1 });
  });

  it("unassignMany usa DELETE con pickup_ids=1,2,3 en la query", async () => {
    replies = [
      { success: true, data: { assigned: 3, failed: 0, results: [] } },
    ];
    const res = await pickupsService.unassignMany([1, 2, 3]);
    expect(calls[0]).toMatchObject({
      url: "/api_pickup_driver_assignment",
      opts: { method: "DELETE", query: { pickup_ids: "1,2,3" } },
    });
    expect(res.assigned).toBe(3);
  });

  it("unassignMany sin ids no llama al API", async () => {
    const res = await pickupsService.unassignMany([]);
    expect(calls).toHaveLength(0);
    expect(res).toEqual({ assigned: 0, failed: 0, results: [] });
  });

  it("recurringConfig y toggleRecurring respetan el contrato", async () => {
    await pickupsService.recurringConfig(7);
    await pickupsService.toggleRecurring(7, false);
    expect(calls[0]).toMatchObject({
      url: "/api_pickup_recurring",
      opts: { method: "GET", query: { id_sede: "7" } },
    });
    expect(calls[1]).toMatchObject({
      opts: { method: "PUT", body: { id_sede: 7, enable: false } },
    });
  });

  it("generateDaily solo envía dry_run e include_non_business_days si se activan", async () => {
    await pickupsService.generateDaily("2030-03-06");
    await pickupsService.generateDaily("2030-03-06", {
      dry_run: true,
      include_non_business_days: true,
    });
    await pickupsService.generateDaily("2030-03-06", { dry_run: false });
    expect(calls[0].opts.body).toEqual({ date: "2030-03-06" });
    expect(calls[1].opts.body).toEqual({
      date: "2030-03-06",
      dry_run: true,
      include_non_business_days: true,
    });
    expect(calls[2].opts.body).toEqual({ date: "2030-03-06" });
  });

  it("generateDaily devuelve los contadores nuevos tal cual", async () => {
    const data = {
      date: "2030-03-06",
      generated: 2,
      skipped: 1,
      invalid: 0,
      skipped_courier: 1,
      skipped_rest_day: 0,
      calendar_errors: 0,
      locked: false,
      dry_run: true,
    };
    replies = [{ success: true, data }];
    expect(
      await pickupsService.generateDaily("2030-03-06", { dry_run: true }),
    ).toEqual(data);
  });
});
