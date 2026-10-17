/**
 * Capa de acceso a los 3 endpoints del módulo giacenze. Usa el http client
 * compartido (@shared/anagrafiche/services/http): ofetch con baseURL =
 * __TMWE_NAV__.basePath, refresh de token y eventos de error globales.
 *
 * Endpoints (Web_* wrappers, hybrid auth sesión+Bearer):
 *   GET/POST/PUT/DELETE  api_inventory_crud
 *   GET/PUT/POST         api_giacenze_operations
 *   GET                  api_giacenze_aging
 */
import { http } from "@shared/anagrafiche/services/http";
import type {
  Giacenza,
  GiacenzaFilters,
  GiacenzaWritePayload,
  GiacenzaOperation,
  PaginatedResult,
  AgingResult,
  ContactDateField,
  ShipmentAddresses,
  GiacenzaMessage,
} from "../types";

interface SingleEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Construye los query params del listado a partir de los filtros UI. */
function buildListQuery(
  filters: GiacenzaFilters,
  page: number,
  perPage: number,
): Record<string, string> {
  const q: Record<string, string> = {
    page: String(page),
    per_page: String(perPage),
  };
  if (filters.indicator) q.indicator = filters.indicator;
  if (filters.id_spedizione) q.id_spedizione = String(filters.id_spedizione);
  if (filters.id_cliente) q.id_cliente = String(filters.id_cliente);
  if (filters.q) q.q = filters.q;
  if (filters.operazione) q.operazione = filters.operazione;
  if (filters.data_open_da) q.data_open_da = filters.data_open_da;
  if (filters.data_open_a) q.data_open_a = filters.data_open_a;
  if (filters.open_only) q.open_only = "1";
  return q;
}

export const giacenzeService = {
  /** Listado filtrable y paginado de giacenze. */
  async list(
    filters: GiacenzaFilters,
    page: number,
    perPage: number,
  ): Promise<PaginatedResult<Giacenza>> {
    return http<PaginatedResult<Giacenza>>("/api_inventory_crud", {
      method: "GET",
      query: buildListQuery(filters, page, perPage),
    });
  },

  /**
   * Direcciones de entrega de una expedición: la actual (D) y, si la entrega
   * se redirigió con giacenza, la original (V, solo lectura).
   */
  async getShipmentAddresses(shipmentId: number): Promise<ShipmentAddresses> {
    const res = await http<SingleEnvelope<ShipmentAddresses>>(
      "/api_shipment_addresses",
      { method: "GET", query: { shipment_id: String(shipmentId) } },
    );
    return res.data;
  },

  /**
   * "Copia prezzo": importe de carico de la expedición, en la divisa del
   * cliente, para prellenar addebito_riconsegna.
   */
  async caricoPrice(
    id: number,
  ): Promise<{ carico_display: number; currency: string }> {
    const res = await http<
      SingleEnvelope<{ carico_display: number; currency: string }>
    >("/api_giacenze_operations", {
      method: "POST",
      body: { action: "carico_price", id },
    });
    return res.data;
  },

  /** Historial de mensajes (GIAc/GIAf) de una giacenza. */
  async messageHistory(id: number): Promise<GiacenzaMessage[]> {
    const res = await http<SingleEnvelope<GiacenzaMessage[]>>(
      "/api_giacenze_message",
      { method: "GET", query: { id: String(id) } },
    );
    return res.data ?? [];
  },

  /** Envía un mensaje al cliente (GIAc) o al fornitore (GIAf). */
  async sendMessage(
    id: number,
    tipo: "GIAc" | "GIAf",
    destMsg: string,
    text = "",
  ): Promise<{ docsstory_id: number }> {
    const res = await http<SingleEnvelope<{ docsstory_id: number }>>(
      "/api_giacenze_message",
      { method: "POST", body: { id, tipo, dest_msg: destMsg, text } },
    );
    return res.data;
  },

  /** Una giacenza por id (con IDOR guard backend). */
  async get(id: number): Promise<Giacenza> {
    const res = await http<SingleEnvelope<Giacenza>>("/api_inventory_crud", {
      method: "GET",
      query: { id: String(id) },
    });
    return res.data;
  },

  /** Crea una giacenza. */
  async create(payload: GiacenzaWritePayload): Promise<Giacenza> {
    const res = await http<SingleEnvelope<Giacenza>>("/api_inventory_crud", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },

  /** Actualiza la cabecera de una giacenza (recalcula coste storage en backend). */
  async update(
    id: number,
    payload: Partial<GiacenzaWritePayload>,
  ): Promise<Giacenza> {
    const res = await http<SingleEnvelope<Giacenza>>("/api_inventory_crud", {
      method: "PUT",
      body: { id, ...payload },
    });
    return res.data;
  },

  /** Soft-delete de una giacenza. */
  async remove(id: number): Promise<void> {
    await http("/api_inventory_crud", {
      method: "DELETE",
      query: { id: String(id) },
    });
  },

  /** Historial / timeline de operaciones de una giacenza. */
  async operationsHistory(id: number): Promise<Giacenza> {
    const res = await http<SingleEnvelope<Giacenza>>(
      "/api_giacenze_operations",
      {
        method: "GET",
        query: { id: String(id) },
      },
    );
    return res.data;
  },

  /** Cambia la operación + fechas de contacto. */
  async updateOperation(
    id: number,
    operation: GiacenzaOperation,
    contactDates: Partial<Record<ContactDateField, string | null>>,
  ): Promise<Giacenza> {
    const res = await http<SingleEnvelope<Giacenza>>(
      "/api_giacenze_operations",
      {
        method: "PUT",
        body: { id, operation, ...contactDates },
      },
    );
    return res.data;
  },

  /** Cierra una giacenza (single). */
  async close(id: number): Promise<void> {
    await http("/api_giacenze_operations", {
      method: "POST",
      body: { action: "close", id },
    });
  },

  /**
   * Abre-o-crea la giacenza de una expedición (paridad legacy CreateGiac):
   * find-or-create en backend + notificación GIAc al cliente. Devuelve la
   * giacenza nueva o la existente. `sendNotification=false` la crea sin email.
   */
  async createFromShipment(
    shipmentId: number,
    sendNotification = true,
  ): Promise<Giacenza> {
    const res = await http<SingleEnvelope<Giacenza>>(
      "/api_giacenze_operations",
      {
        method: "POST",
        body: {
          action: "create_from_shipment",
          shipment_id: shipmentId,
          send_notification: sendNotification,
        },
      },
    );
    return res.data;
  },

  /** Cierre masivo de giacenze vencidas (admin). */
  async autoClose(
    maxDays: number,
  ): Promise<{ closed?: number; [k: string]: unknown }> {
    const res = await http<SingleEnvelope<{ closed?: number }>>(
      "/api_giacenze_operations",
      {
        method: "POST",
        body: { action: "auto_close", max_days: maxDays },
      },
    );
    return res.data;
  },

  /** Análisis de aging (bandas por días). */
  async aging(partnerId?: number | null): Promise<AgingResult> {
    const query: Record<string, string> = {};
    if (partnerId) query.partner_id = String(partnerId);
    const res = await http<SingleEnvelope<AgingResult>>("/api_giacenze_aging", {
      method: "GET",
      query,
    });
    return res.data;
  },
};
