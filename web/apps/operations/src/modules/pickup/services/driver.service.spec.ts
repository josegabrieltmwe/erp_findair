import { beforeEach, describe, expect, it, vi } from "vitest";

/** Servicio de autistas: giro, manifiesto y guardado en lote de zonas. */
const calls: Array<{ url: string; opts: Record<string, unknown> }> = [];
let reply: unknown = { success: true, data: {} };
let failOn: ((url: string, opts: Record<string, unknown>) => boolean) | null =
  null;

vi.mock("@shared/anagrafiche/services/http", () => ({
  http: vi.fn(async (url: string, opts: Record<string, unknown> = {}) => {
    calls.push({ url, opts });
    if (failOn?.(url, opts)) throw new Error("CAP no encontrado");
    return reply;
  }),
}));

import { driverService } from "./driver.service";

beforeEach(() => {
  calls.length = 0;
  reply = { success: true, data: {} };
  failOn = null;
});

describe("driverService", () => {
  it("buildRoute pide el giro del autista y la fecha", async () => {
    await driverService.buildRoute(9, "2030-03-06");
    expect(calls[0]).toMatchObject({
      url: "/api_driver_routes",
      opts: { method: "GET", query: { driver_id: "9", date: "2030-03-06" } },
    });
  });

  it("manifest devuelve las paradas con kind, direccion y shipments", async () => {
    const data = {
      date: "2030-03-06",
      driver: { id: 9, nome: "Autista Prueba", cell: "", tel: "" },
      summary: {
        total_stops: 1,
        total_colli: 0,
        total_peso: 0,
        total_deliveries: 1,
        total_contrassegno: 50,
      },
      stops: [
        {
          order: 1,
          pickup_id: 1,
          kind: "C",
          direccion: { origen: "expedicion", indirizzo: "Via Prova 1" },
          shipments: [
            { id: 5, ldv: "0000000005", colli: 1, peso: 2, contrassegno: 50 },
          ],
        },
      ],
    };
    reply = { success: true, data };
    const m = await driverService.manifest(9, "2030-03-06");
    expect(calls[0]).toMatchObject({
      url: "/api_driver_manifest",
      opts: { query: { driver_id: "9", date: "2030-03-06" } },
    });
    expect(m.stops[0].shipments?.[0].contrassegno).toBe(50);
    expect(m.summary.total_contrassegno).toBe(50);
  });

  it("zonesByProvincia añade id_contatto solo si se pide", async () => {
    await driverService.zonesByProvincia("XX");
    await driverService.zonesByProvincia("XX", 4);
    expect(calls[0].opts.query).toEqual({ id_provincia: "XX" });
    expect(calls[1].opts.query).toEqual({
      id_provincia: "XX",
      id_contatto: "4",
    });
  });

  it("saveZones asigna (POST) o quita (DELETE) cada CAP", async () => {
    const items = await driverService.saveZones([
      { cap: "00100", id_contatto: 5 },
      { cap: "00101", id_contatto: 0 },
    ]);
    expect(calls[0]).toMatchObject({
      url: "/api_driver_zones",
      opts: { method: "POST", body: { cap: "00100", id_contatto: 5 } },
    });
    expect(calls[1]).toMatchObject({
      opts: { method: "DELETE", query: { cap: "00101" } },
    });
    expect(items).toEqual([
      { cap: "00100", id_contatto: 5, ok: true },
      { cap: "00101", id_contatto: 0, ok: true },
    ]);
  });

  it("saveZones informa por CAP y un fallo no impide guardar los demás", async () => {
    failOn = (_url, opts) =>
      (opts.body as { cap?: string } | undefined)?.cap === "00200";
    const items = await driverService.saveZones([
      { cap: "00100", id_contatto: 5 },
      { cap: "00200", id_contatto: 6 },
      { cap: "00300", id_contatto: 7 },
    ]);
    expect(calls).toHaveLength(3);
    expect(items.map((i) => i.ok)).toEqual([true, false, true]);
    expect(items[1].error).toBe("CAP no encontrado");
  });

  it("registerPod envía el cuerpo de la entrega", async () => {
    await driverService.registerPod({
      ldv: "0000000005",
      esito: "C",
      note: "ok",
    });
    expect(calls[0]).toMatchObject({
      url: "/api_driver_pod",
      opts: {
        method: "POST",
        body: { ldv: "0000000005", esito: "C", note: "ok" },
      },
    });
  });

  it("registerPod envía firma_nome y devuelve signature_file_id y warnings", async () => {
    reply = {
      success: true,
      data: {
        signature_file_id: 12,
        state_updated: true,
        warnings: ["gps_no_valido"],
      },
    };
    const res = await driverService.registerPod({
      ldv: "0000000005",
      esito: "C",
      firma_nome: "Receptor Prueba",
    });
    expect(calls[0].opts.body).toEqual({
      ldv: "0000000005",
      esito: "C",
      firma_nome: "Receptor Prueba",
    });
    expect(res.signature_file_id).toBe(12);
    expect(res.warnings).toEqual(["gps_no_valido"]);
  });
});
