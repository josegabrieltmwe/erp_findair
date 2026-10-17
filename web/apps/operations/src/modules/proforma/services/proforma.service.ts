/**
 * Capa de acceso a los 4 endpoints del módulo proforma. Usa el http client
 * compartido (@shared/anagrafiche/services/http). Todos los endpoints son
 * Web_* wrappers (hybrid auth sesión+Bearer).
 *
 *   GET/POST/PUT/DELETE  api_proforma_crud      (cabecera + items en cascade)
 *   GET/POST/PUT/DELETE  api_proforma_items     (líneas individuales)
 *   POST                 api_proforma_duplicate (a otro envío)
 *   GET                  api_proforma_lookup    (?type=motivi|units)
 */
import { http } from "@shared/anagrafiche/services/http";
import type {
  Proforma,
  ProformaFilters,
  ProformaWritePayload,
  ProformaListResult,
  LookupOption,
} from "../types";

interface SingleEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function buildListQuery(
  filters: ProformaFilters,
  page: number,
  perPage: number,
): Record<string, string> {
  const q: Record<string, string> = {
    page: String(page),
    per_page: String(perPage),
  };
  if (filters.id_spedizione) q.id_spedizione = String(filters.id_spedizione);
  if (filters.date_from) q.date_from = filters.date_from;
  if (filters.date_to) q.date_to = filters.date_to;
  if (filters.iso_paese_origine)
    q.iso_paese_origine = filters.iso_paese_origine;
  return q;
}

export const proformaService = {
  /** Listado paginado de proformas. La lista vuelve como {data, pagination}. */
  async list(
    filters: ProformaFilters,
    page: number,
    perPage: number,
  ): Promise<ProformaListResult> {
    return http<ProformaListResult>("/api_proforma_crud", {
      method: "GET",
      query: buildListQuery(filters, page, perPage),
    });
  },

  /** Una proforma por id, con items[] embebidos. */
  async get(id: number): Promise<Proforma> {
    const res = await http<SingleEnvelope<Proforma>>("/api_proforma_crud", {
      method: "GET",
      query: { id: String(id) },
    });
    return res.data;
  },

  /** Crea proforma (cabecera + items en cascade). */
  async create(payload: ProformaWritePayload): Promise<Proforma> {
    const res = await http<SingleEnvelope<Proforma>>("/api_proforma_crud", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },

  /** Actualiza proforma (reemplaza items si se pasan en el payload). */
  async update(
    id: number,
    payload: Partial<ProformaWritePayload>,
  ): Promise<Proforma> {
    const res = await http<SingleEnvelope<Proforma>>("/api_proforma_crud", {
      method: "PUT",
      body: { id, ...payload },
    });
    return res.data;
  },

  /** Elimina proforma + cascade de items. */
  async remove(id: number): Promise<void> {
    await http("/api_proforma_crud", {
      method: "DELETE",
      query: { id: String(id) },
    });
  },

  /** Duplica una proforma a otro envío. */
  async duplicate(id: number, targetShipmentId: number): Promise<Proforma> {
    const res = await http<SingleEnvelope<Proforma>>(
      "/api_proforma_duplicate",
      {
        method: "POST",
        body: { id, target_shipment_id: targetShipmentId },
      },
    );
    return res.data;
  },

  /** Lookup de motivos o unidades. */
  async lookup(type: "motivi" | "units"): Promise<LookupOption[]> {
    const res = await http<SingleEnvelope<LookupOption[]>>(
      "/api_proforma_lookup",
      {
        method: "GET",
        query: { type },
      },
    );
    return res.data;
  },
};
