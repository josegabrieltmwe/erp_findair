/**
 * Acceso a los endpoints de gestión de prese (tabla `prese`), calendario,
 * asignación de autistas y configuración recurrente. Todos son Web_* con auth
 * híbrida (sesión+Bearer); ruteo REST por método HTTP (no `op`).
 *
 *   GET/POST/PUT/DELETE  api_pickups_crud
 *   GET                  api_pickup_calendar
 *   GET/POST/DELETE      api_pickup_driver_assignment
 *   GET/POST/PUT         api_pickup_recurring
 */
import { http } from "@shared/anagrafiche/services/http";
import { BULK_LIMIT, chunk, mergeBulkResults } from "../logic";
import type {
  ApiEnvelope,
  BulkResult,
  CalendarResult,
  Driver,
  GenerateDailyOptions,
  GenerateDailyResult,
  Paginated,
  Pickup,
  PickupFilters,
  PickupWritePayload,
  RecurringConfig,
} from "../types";

export function buildListQuery(
  filters: PickupFilters,
  page: number,
  perPage: number,
): Record<string, string> {
  const q: Record<string, string> = {
    page: String(page),
    per_page: String(perPage),
  };
  if (filters.id_sede) q.id_sede = String(filters.id_sede);
  if (filters.id_contatti) q.id_contatti = String(filters.id_contatti);
  if (filters.affidata) q.affidata = filters.affidata;
  if (filters.presa_fissa) q.presa_fissa = filters.presa_fissa;
  if (filters.autogen) q.autogen = filters.autogen;
  if (filters.data) q.data = filters.data;
  if (filters.data_da) q.data_da = filters.data_da;
  if (filters.data_a) q.data_a = filters.data_a;
  if (filters.data_ritiro) q.data_ritiro = filters.data_ritiro;
  return q;
}

export const pickupsService = {
  /** Listado filtrable y paginado de prese. */
  async list(
    filters: PickupFilters,
    page: number,
    perPage: number,
  ): Promise<Paginated<Pickup>> {
    return http<Paginated<Pickup>>("/api_pickups_crud", {
      method: "GET",
      query: buildListQuery(filters, page, perPage),
    });
  },

  async get(id: number): Promise<Pickup> {
    const r = await http<ApiEnvelope<Pickup>>("/api_pickups_crud", {
      method: "GET",
      query: { id: String(id) },
    });
    return r.data;
  },

  async create(payload: PickupWritePayload): Promise<Pickup> {
    const r = await http<ApiEnvelope<Pickup>>("/api_pickups_crud", {
      method: "POST",
      body: payload,
    });
    return r.data;
  },

  async update(id: number, payload: PickupWritePayload): Promise<Pickup> {
    const r = await http<ApiEnvelope<Pickup>>("/api_pickups_crud", {
      method: "PUT",
      body: { ...payload, id },
    });
    return r.data;
  },

  /**
   * Borra una presa. El API decide: una fija pasa a «fija retirada» (R, solo ese
   * día) y una no fija se anula (`stato='O'`).
   */
  async remove(id: number): Promise<void> {
    await http<ApiEnvelope<{ deleted: boolean }>>("/api_pickups_crud", {
      method: "DELETE",
      query: { id: String(id) },
    });
  },

  /** Calendario en un rango de fechas, agrupado por día. */
  async calendar(
    dateFrom: string,
    dateTo: string,
    driverId?: number,
  ): Promise<CalendarResult> {
    const query: Record<string, string> = {
      date_from: dateFrom,
      date_to: dateTo,
    };
    if (driverId) query.driver_id = String(driverId);
    const r = await http<ApiEnvelope<CalendarResult>>("/api_pickup_calendar", {
      method: "GET",
      query,
    });
    return r.data;
  },

  /** Autistas disponibles para asignar en una fecha. */
  async availableDrivers(date: string): Promise<Driver[]> {
    const r = await http<ApiEnvelope<{ date: string; drivers: Driver[] }>>(
      "/api_pickup_driver_assignment",
      { method: "GET", query: { date } },
    );
    return r.data.drivers;
  },

  async assignDriver(pickupId: number, driverId: number): Promise<Pickup> {
    const r = await http<ApiEnvelope<Pickup>>("/api_pickup_driver_assignment", {
      method: "POST",
      body: { pickup_id: pickupId, driver_id: driverId },
    });
    return r.data;
  },

  async unassignDriver(pickupId: number): Promise<Pickup> {
    const r = await http<ApiEnvelope<Pickup>>("/api_pickup_driver_assignment", {
      method: "DELETE",
      query: { pickup_id: String(pickupId) },
    });
    return r.data;
  },

  /** Asigna un autista a varias presas (máx. 200 por petición; se trocea si hay más). */
  async assignMany(pickupIds: number[], driverId: number): Promise<BulkResult> {
    const parts: BulkResult[] = [];
    for (const ids of chunk(pickupIds, BULK_LIMIT)) {
      const r = await http<ApiEnvelope<BulkResult>>(
        "/api_pickup_driver_assignment",
        { method: "POST", body: { pickup_ids: ids, driver_id: driverId } },
      );
      parts.push(r.data);
    }
    return mergeBulkResults(parts);
  },

  /** Libera el autista de varias presas (`pickup_ids=1,2,3` en la query). */
  async unassignMany(pickupIds: number[]): Promise<BulkResult> {
    const parts: BulkResult[] = [];
    for (const ids of chunk(pickupIds, BULK_LIMIT)) {
      const r = await http<ApiEnvelope<BulkResult>>(
        "/api_pickup_driver_assignment",
        { method: "DELETE", query: { pickup_ids: ids.join(",") } },
      );
      parts.push(r.data);
    }
    return mergeBulkResults(parts);
  },

  /** Config recurrente (presa fissa) de una sede. */
  async recurringConfig(idSede: number): Promise<RecurringConfig> {
    const r = await http<ApiEnvelope<RecurringConfig>>(
      "/api_pickup_recurring",
      {
        method: "GET",
        query: { id_sede: String(idSede) },
      },
    );
    return r.data;
  },

  async toggleRecurring(
    idSede: number,
    enable: boolean,
  ): Promise<RecurringConfig> {
    const r = await http<ApiEnvelope<RecurringConfig>>(
      "/api_pickup_recurring",
      {
        method: "PUT",
        body: { id_sede: idSede, enable },
      },
    );
    return r.data;
  },

  /**
   * Genera las prese diarias de las sedes con presa fissa. Con `dry_run` solo
   * cuenta lo que se generaría; `include_non_business_days` ignora los días de
   * descanso del partner. Solo se envían las opciones activadas.
   */
  async generateDaily(
    date: string,
    options: GenerateDailyOptions = {},
  ): Promise<GenerateDailyResult> {
    const body: Record<string, unknown> = { date };
    if (options.dry_run) body.dry_run = true;
    if (options.include_non_business_days)
      body.include_non_business_days = true;
    const r = await http<ApiEnvelope<GenerateDailyResult>>(
      "/api_pickup_recurring",
      { method: "POST", body },
    );
    return r.data;
  },
};
