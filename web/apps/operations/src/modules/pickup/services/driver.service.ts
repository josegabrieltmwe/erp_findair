/**
 * Giro del autista, manifiesto, zonas CAP→autista y POD.
 *
 *   GET/POST         api_driver_routes    (summary / build_daily_route / assign)
 *   GET/POST/DELETE  api_driver_zones     (provinces / by_cap / by_provincia / assign / clear)
 *   GET              api_driver_manifest  (manifest_data / summary)
 *   GET/POST         api_driver_delivery  (verify_ldv / register)
 *   POST             api_driver_pod       (registrar POD)
 */
import { http } from "@shared/anagrafiche/services/http";
import type {
  ApiEnvelope,
  Driver,
  DriverRoute,
  DriverZone,
  LdvLookup,
  Manifest,
  PodPayload,
  Province,
  RouteDaySummary,
} from "../types";

export const driverService = {
  /** Resumen del día (todos los autistas). */
  async daySummary(date: string): Promise<RouteDaySummary> {
    const r = await http<ApiEnvelope<RouteDaySummary>>("/api_driver_routes", {
      method: "GET",
      query: { summary: "1", date },
    });
    return r.data;
  },

  /** Autistas con prese en la fecha. */
  async driversForDate(
    date: string,
  ): Promise<{ date: string; drivers: Driver[]; total: number }> {
    const r = await http<
      ApiEnvelope<{ date: string; drivers: Driver[]; total: number }>
    >("/api_driver_routes", { method: "GET", query: { date } });
    return r.data;
  },

  /** Giro diario ordenado de un autista. */
  async buildRoute(driverId: number, date: string): Promise<DriverRoute> {
    const r = await http<ApiEnvelope<DriverRoute>>("/api_driver_routes", {
      method: "GET",
      query: { driver_id: String(driverId), date },
    });
    return r.data;
  },

  async assignPickup(pickupId: number, driverId: number): Promise<unknown> {
    const r = await http<ApiEnvelope<unknown>>("/api_driver_routes", {
      method: "POST",
      body: { pickup_id: pickupId, driver_id: driverId },
    });
    return r.data;
  },

  /** Manifiesto/borderò de un autista para una fecha. */
  async manifest(driverId: number, date: string): Promise<Manifest> {
    const r = await http<ApiEnvelope<Manifest>>("/api_driver_manifest", {
      method: "GET",
      query: { driver_id: String(driverId), date },
    });
    return r.data;
  },

  // --- Zonas CAP→autista ---

  async provinces(): Promise<Province[]> {
    const r = await http<ApiEnvelope<Province[]>>("/api_driver_zones", {
      method: "GET",
      query: { provinces: "1" },
    });
    return r.data;
  },

  async zonesByProvincia(
    idProvincia: string,
    idContatto?: number,
  ): Promise<{ id_provincia: string; zones: DriverZone[]; total: number }> {
    const query: Record<string, string> = { id_provincia: idProvincia };
    if (idContatto) query.id_contatto = String(idContatto);
    const r = await http<
      ApiEnvelope<{ id_provincia: string; zones: DriverZone[]; total: number }>
    >("/api_driver_zones", { method: "GET", query });
    return r.data;
  },

  async assignZone(cap: string, idContatto: number): Promise<unknown> {
    const r = await http<ApiEnvelope<unknown>>("/api_driver_zones", {
      method: "POST",
      body: { cap, id_contatto: idContatto },
    });
    return r.data;
  },

  async clearZone(cap: string): Promise<void> {
    await http<ApiEnvelope<unknown>>("/api_driver_zones", {
      method: "DELETE",
      query: { cap },
    });
  },

  // --- POD / prueba de entrega ---

  /** Busca una expedición por su LDV (RIF_cliente o AWB) para confirmar entrega. */
  async verifyLdv(ldv: string): Promise<LdvLookup> {
    const r = await http<ApiEnvelope<LdvLookup>>("/api_driver_delivery", {
      method: "GET",
      query: { ldv },
    });
    return r.data;
  },

  /** Registra la entrega (POD): esito, nota, firma y geolocalización. */
  async registerPod(payload: PodPayload): Promise<unknown> {
    const r = await http<ApiEnvelope<unknown>>("/api_driver_pod", {
      method: "POST",
      body: payload,
    });
    return r.data;
  },
};
