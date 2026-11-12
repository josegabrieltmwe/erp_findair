import { beforeEach, describe, expect, it, vi } from "vitest";

/** Panel operativo: vista general, por autista y alertas. */
const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let reply: unknown = { success: true, data: [] };
let failWith: Error | null = null;

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    if (failWith) throw failWith;
    return reply;
  }),
}));

import { operationsService } from "./operations.service";

beforeEach(() => {
  calls.length = 0;
  reply = { success: true, data: [] };
  failWith = null;
});

describe("operationsService", () => {
  it("overview sin fecha no manda parámetros", async () => {
    await operationsService.overview();
    expect(calls[0]).toMatchObject({
      url: "/api_operations_panel",
      opts: { method: "GET", query: {} },
    });
  });

  it("byDriver pide view=drivers con la fecha y devuelve las filas", async () => {
    const rows = [
      {
        driver_id: 3,
        driver_name: "Autista Prueba",
        pickup_count: 2,
        total_colli: 4,
        total_peso: 7.5,
      },
    ];
    reply = { success: true, data: rows };
    const res = await operationsService.byDriver("2030-03-06");
    expect(calls[0].opts.query).toEqual({
      view: "drivers",
      date: "2030-03-06",
    });
    expect(res).toEqual(rows);
  });

  it("alerts usa el umbral por defecto de 15 días o el indicado", async () => {
    await operationsService.alerts();
    await operationsService.alerts(30);
    expect(calls[0].opts.query).toEqual({ view: "alerts", threshold: "15" });
    expect(calls[1].opts.query).toEqual({ view: "alerts", threshold: "30" });
  });

  it("propaga el 403 del API (un autista restringido no ve el panel)", async () => {
    failWith = new Error("DRIVER_SCOPE_DENIED");
    await expect(operationsService.byDriver()).rejects.toThrow(
      "DRIVER_SCOPE_DENIED",
    );
  });
});
