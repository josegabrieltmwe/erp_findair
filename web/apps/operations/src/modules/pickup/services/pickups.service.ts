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
import type {
  ApiEnvelope,
  CalendarResult,
  Driver,
  Paginated,
  Pickup,
  PickupFilters,
  PickupWritePayload,
  RecurringConfig,
} from "../types";

function buildListQuery(
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

  /** Genera las prese diarias de las sedes con presa fissa. */
  async generateDaily(
    date: string,
  ): Promise<{ date: string; generated: number; skipped: number }> {
    const r = await http<
      ApiEnvelope<{ date: string; generated: number; skipped: number }>
    >("/api_pickup_recurring", { method: "POST", body: { date } });
    return r.data;
  },
};
