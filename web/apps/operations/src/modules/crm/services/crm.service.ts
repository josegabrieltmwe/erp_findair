/**
 * Capa de acceso a los endpoints CRM (paridad crm_form.php / crm_exe / SNDMSG).
 * Usa el http client compartido (@shared/anagrafiche/services/http): ofetch con
 * baseURL = __TMWE_NAV__.basePath, refresh de token y eventos de error globales.
 *
 * Endpoints (config/routes/crm.yml, hybrid auth sesión+Bearer):
 *   api_crm_crud       GET(?id | lista) / POST / PUT / DELETE
 *   api_crm_events     GET ?id_crm / POST / DELETE
 *   api_crm_types      GET
 *   api_crm_message    GET ?id_crm (historial) / POST (enviar al cliente)
 */
import { http } from "@shared/anagrafiche/services/http";
import type {
  CrmPratica,
  CrmEvento,
  CrmTipo,
  CrmMessaggio,
  PaginatedResult,
  SingleEnvelope,
  SendMessagePayload,
  StatoPratica,
} from "../types";

export interface CrmListFilters {
  indicator?: "open_cases" | "overdue_followups" | "";
  stato_pratica?: StatoPratica | "";
  id_crm_tipo?: number | null;
  id_anagrafica?: number | null;
  id_spedizione?: number | null;
  oggetto?: string;
  data_open_da?: string;
  data_open_al?: string;
  /** Legacy ti=alert: pratiche abiertas en las últimas 240 h. */
  alert?: boolean;
  /** alert + last_step='C' (variante estricta). */
  escalation?: boolean;
  open_no_todo?: boolean;
}

/** Orden: la clave debe estar en la whitelist de Crm_Service::SORTABLE_COLUMNS. */
export interface CrmListSort {
  key: string;
  dir: "asc" | "desc";
}

function buildListQuery(
  filters: CrmListFilters,
  page: number,
  perPage: number,
  sort?: CrmListSort | null,
): Record<string, string> {
  const q: Record<string, string> = {
    page: String(page),
    limit: String(perPage),
  };
  if (filters.stato_pratica) q.stato_pratica = filters.stato_pratica;
  if (filters.id_crm_tipo) q.id_crm_tipo = String(filters.id_crm_tipo);
  if (filters.id_anagrafica) q.id_anagrafica = String(filters.id_anagrafica);
  if (filters.id_spedizione) q.id_spedizione = String(filters.id_spedizione);
  if (filters.oggetto) q.oggetto = filters.oggetto;
  if (filters.data_open_da) q.data_open_da = filters.data_open_da;
  if (filters.data_open_al) q.data_open_al = filters.data_open_al;
  if (filters.alert) q.alert = "1";
  if (filters.escalation) q.escalation = "1";
  if (filters.open_no_todo) q.open_no_todo = "1";
  if (filters.indicator) q.indicator = filters.indicator;
  if (sort?.key) {
    q.sort = sort.key;
    q.dir = sort.dir;
  }
  return q;
}

export const crmService = {
  // ─── Pratiche (cabecera) ─────────────────────────────────────
  /**
   * El endpoint responde con el envelope de Paginated_Response_Trait:
   * `{success, data: [...], pagination: {total, page, per_page, ...}}`.
   * Se normaliza aquí a {items,total} porque el store consume esa forma;
   * leer `res.items`/`res.total` directamente daba siempre lista vacía.
   */
  async list(
    filters: CrmListFilters,
    page: number,
    perPage: number,
    sort?: CrmListSort | null,
  ): Promise<PaginatedResult<CrmPratica>> {
    const res = await http<{
      data?: CrmPratica[];
      pagination?: { total?: number; page?: number; per_page?: number };
    }>("/api_crm_crud", {
      method: "GET",
      query: buildListQuery(filters, page, perPage, sort),
    });

    const items = Array.isArray(res?.data) ? res.data : [];
    return {
      items,
      total: res?.pagination?.total ?? items.length,
      page: res?.pagination?.page ?? page,
      limit: res?.pagination?.per_page ?? perPage,
    };
  },

  /** Una pratica por id (incluye events[]). */
  async get(id: number): Promise<CrmPratica> {
    const res = await http<SingleEnvelope<CrmPratica>>("/api_crm_crud", {
      method: "GET",
      query: { id: String(id) },
    });
    return res.data;
  },

  async create(payload: Partial<CrmPratica>): Promise<CrmPratica> {
    const res = await http<SingleEnvelope<CrmPratica>>("/api_crm_crud", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },

  async update(id: number, payload: Partial<CrmPratica>): Promise<CrmPratica> {
    const res = await http<SingleEnvelope<CrmPratica>>("/api_crm_crud", {
      method: "PUT",
      body: { id, ...payload },
    });
    return res.data;
  },

  async remove(id: number): Promise<void> {
    await http("/api_crm_crud", {
      method: "DELETE",
      query: { id: String(id) },
    });
  },

  /** Auto-crear pratica desde una spedizione (dedup por id_spedizione). */
  async createFromShipment(shipmentId: number): Promise<CrmPratica> {
    const res = await http<SingleEnvelope<CrmPratica>>("/api_crm_crud", {
      method: "POST",
      body: { action: "create_from_shipment", shipment_id: shipmentId },
    });
    return res.data;
  },

  // ─── Eventi / avanzamenti (crm_exe) ──────────────────────────
  async listEvents(idCrm: number): Promise<CrmEvento[]> {
    const res = await http<SingleEnvelope<CrmEvento[]>>("/api_crm_events", {
      method: "GET",
      query: { id_crm: String(idCrm) },
    });
    return res.data ?? [];
  },

  async addEvent(
    idCrm: number,
    descriz: string,
    statoPratica: StatoPratica,
  ): Promise<CrmEvento> {
    const res = await http<SingleEnvelope<CrmEvento>>("/api_crm_events", {
      method: "POST",
      body: { id_crm: idCrm, descriz, stato_pratica: statoPratica },
    });
    return res.data;
  },

  /**
   * Edita la descripción de un evento de progreso ya creado (paridad legacy
   * crm_update.php?frm=not2). Se dispara on-blur desde la timeline.
   */
  async updateEvent(
    id: number,
    payload: import("../types").CrmEventoUpdate,
  ): Promise<CrmEvento> {
    const res = await http<SingleEnvelope<CrmEvento>>("/api_crm_events", {
      method: "PUT",
      body: { id, ...payload },
    });
    return res.data;
  },

  async removeEvent(id: number): Promise<void> {
    await http("/api_crm_events", {
      method: "DELETE",
      query: { id: String(id) },
    });
  },

  // ─── Tipi (crm_tipi) ─────────────────────────────────────────
  // CRUD completo de administración vive en packages/platform/crm_types
  // (Settings → B2B task types), no aquí — este módulo solo consume la
  // lista para el selector del formulario de pratica.
  async listTypes(): Promise<CrmTipo[]> {
    const res = await http<SingleEnvelope<CrmTipo[]>>("/api_crm_types", {
      method: "GET",
    });
    return res.data ?? [];
  },

  // ─── Comunicación con el cliente (SNDMSG) ────────────────────
  /** Historial de mensajes salientes de la pratica (docsstory_ilist). */
  async listMessages(idCrm: number): Promise<CrmMessaggio[]> {
    const res = await http<SingleEnvelope<PaginatedResult<CrmMessaggio>>>(
      "/api_crm_message",
      { method: "GET", query: { id_crm: String(idCrm) } },
    );
    return res.data?.items ?? [];
  },

  /** Enviar un mensaje al cliente ligado a la pratica. */
  async sendMessage(
    payload: SendMessagePayload,
    files: File[] = [],
  ): Promise<CrmMessaggio> {
    // Con adjuntos → multipart (paridad legacy file1/2/3, hasta 3). Sin
    // adjuntos → JSON como siempre.
    if (files.length) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v != null) fd.append(k, String(v));
      });
      files.slice(0, 3).forEach((f, i) => fd.append(`file${i + 1}`, f, f.name));
      const res = await http<SingleEnvelope<CrmMessaggio>>("/api_crm_message", {
        method: "POST",
        body: fd,
      });
      return res.data;
    }
    const res = await http<SingleEnvelope<CrmMessaggio>>("/api_crm_message", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },
};
