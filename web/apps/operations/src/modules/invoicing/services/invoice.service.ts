/**
 * invoice.service — CRUD y operaciones de facturas. Consume los controllers
 * Web_* (sesión + Bearer). Los verbos van por `op=` (el param `action` está
 * reservado por app.php para el routing).
 */
import { http } from "./http";

export interface InvoiceLine {
  id: number;
  tipo_record: string;
  descriz: string;
  descrizEN?: string | null;
  importo_netto: number;
  importo_iva: number;
  aliquota_iva: number | null;
  cod_iva: string | null;
}

export interface Invoice {
  id: number;
  numero: string | number;
  numero_alfanum?: string;
  data_fattura: string;
  tipo_fattura: string;
  cod_sdi_TD?: string;
  id_anagrafica: number;
  id_anagrafica_partn: number;
  importo_netto: number;
  importo_iva: number;
  valuta_sigla: string;
  stato_sdi: string;
  cliente?: { rag_soc?: string; pi_cf?: string; iso_paese?: string };
  /** Logo del partner emisor (data URI) para la cabecera. Null si no tiene. */
  partner_logo?: string | null;
  /** Idioma en que se emite la factura (idioma del partner): "IT" | "EN". */
  lingua_fattura?: string;
  dettagli?: InvoiceLine[];
  pagamenti?: unknown[];
}

export interface InvoiceListItem {
  id: number | string;
  numero: string | number;
  data_fattura: string;
  tipo_fattura: string;
  stato_sdi: string;
  importo_netto: number | string;
  importo_iva: number | string;
  valuta_sigla: string;
  id_anagrafica?: number | string;
  rag_soc?: string;
  /** Solo facturas recibidas: número externo del proveedor y control. */
  numero_alfanum?: string;
  controllo_stato?: string | null;
  /** Resumen de cobros/pagos de la factura. */
  pagos?: PaymentSummary | null;
}

export type PaymentSummaryStatus = "paid" | "pending" | "overdue" | "none";
export interface PaymentSummary {
  status: PaymentSummaryStatus;
  open_count?: number;
  closed_count?: number;
  pending_amount?: number | string;
  next_due?: string | null;
}

/** Una expedición facturable (fila del listado seleccionable). */
export interface BillableShipment {
  id: number | string;
  tipo: "express" | "cargo";
  data_sped0?: string;
  data_sped1?: string;
  carico: number;
  noiva_art9?: string;
  is_post?: boolean;
  awb?: string;
  rif?: string;
  colli?: number;
  peso?: number;
}

export interface InvoiceListFilters {
  data_da?: string;
  data_a?: string;
  numero?: string;
  stato_sdi?: string;
  tipo_fattura?: string;
  // Filtro por cliente (anagrafica). El backend (Invoice_Crud_Controller) lo
  // aplica sobre f.id_anagrafica; solo TMWE admin puede filtrar por cliente
  // arbitrario, el resto queda auto-scoped a su partner.
  id_anagrafica?: string;
  /** paid | pending | overdue (el servidor responde 400 con otro valor). */
  stato_pagamento?: string;
  /** Solo listado de recibidas (N, S, R) y búsqueda libre. */
  controllo_stato?: string;
  search?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  sort_dir?: "ASC" | "DESC";
}

/**
 * Wrapper de respuesta del backend (Unified_Response_Trait):
 *   { success, data, pagination? }.
 * El http client (ofetch) devuelve el body completo sin desempaquetar.
 */
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  pagination?: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
  error?: string;
}

export interface ShipmentRecapRow {
  data: string;
  dest: string;
  citta: string;
  paese: string;
  colli: number;
  peso: string;
  costo: string;
  fuel: string;
  totale: string;
  awb?: string;
  sped_id?: string | number;
  rif?: string;
  note?: string;
}
export interface ShipmentRecapGroup {
  service_name: string;
  rows: ShipmentRecapRow[];
  tot_costo_fmt: string;
  tot_fuel_fmt: string;
  tot_fmt: string;
}

/** Query del listado: solo manda los filtros con valor. */
export function buildInvoiceListQuery(
  filters: InvoiceListFilters,
): URLSearchParams {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  return qs;
}

/** Por qué una expedición pedida no es facturable (campo `diagnostics` del backend). */
export type BillableDiagnosticCode =
  | "NOT_CONTROLLED"
  | "NOT_ACTIVE"
  | "ALREADY_INVOICED"
  | "ARCHIVED"
  | "NOT_FOUND";

export interface BillableDiagnostic {
  tipo: "express" | "cargo";
  id: number;
  code: BillableDiagnosticCode;
}

export const invoiceService = {
  /** Detalle de una factura. */
  async getById(id: number, signal?: AbortSignal): Promise<Invoice> {
    const res = await http<ApiEnvelope<Invoice>>(
      `/api_invoices_crud?id=${id}`,
      { signal },
    );
    return res.data;
  },

  /** Riepilogo de expediciones de la factura, agrupado por servicio. */
  async shipmentRecap(
    id: number,
    signal?: AbortSignal,
  ): Promise<{
    services: ShipmentRecapGroup[];
    shipment_count: number;
    service_count: number;
  }> {
    const res = await http<
      ApiEnvelope<{
        services: ShipmentRecapGroup[];
        shipment_count: number;
        service_count: number;
      }>
    >(`/api_invoice_shipments?id=${id}`, { signal });
    return res.data;
  },

  /**
   * Listado paginado con filtros. El backend devuelve `data` (array) +
   * `pagination.total` — NO `items`/`total` planos.
   */
  async list(
    filters: InvoiceListFilters = {},
    signal?: AbortSignal,
  ): Promise<{ items: InvoiceListItem[]; total: number }> {
    const qs = buildInvoiceListQuery(filters);
    const res = await http<ApiEnvelope<InvoiceListItem[]>>(
      `/api_invoices_crud?${qs.toString()}`,
      { signal },
    );
    return {
      items: Array.isArray(res.data) ? res.data : [],
      total:
        res.pagination?.total ??
        (Array.isArray(res.data) ? res.data.length : 0),
    };
  },

  /** Recalcula totales/IVA desde las líneas. */
  recalculate(id: number) {
    return http(`/api_invoice_recalculate?op=recalculate`, {
      method: "POST",
      body: { id_fattura: id },
    });
  },

  /**
   * Spedizioni facturables para un cliente (paso previo a generar batch).
   * El backend devuelve `{success, data:[{id_anagrafica, rag_soc, total,
   * shipment_count, shipments[]}]}` filtrado por el cliente.
   */
  billableShipments(
    id_anagrafica: number,
    params: Record<string, string> = {},
  ) {
    const qs = new URLSearchParams({
      id_anagrafica: String(id_anagrafica),
      ...params,
    });
    return http<{
      success: boolean;
      data?: Array<{
        id_anagrafica: number;
        rag_soc?: string;
        total?: number;
        shipment_count?: number;
        shipments?: BillableShipment[];
      }>;
      /** Solo si se pidió una expedición concreta y no es facturable. */
      diagnostics?: BillableDiagnostic[];
    }>(`/api_invoice_billable_shipments?${qs.toString()}`);
  },

  /**
   * Creación MANUAL atómica de una factura con sus líneas (DIV-11). El backend
   * (Invoice_Crud_Controller op=create) detecta `lines[]` y crea cabecera +
   * detalle + totales en una sola operación.
   */
  async createManual(body: {
    id_anagrafica: number;
    data_fattura: string;
    valuta_sigla?: string;
    tipo_fattura?: string;
    descriz?: string;
    lines: Array<{
      tipo_record?: string;
      descriz: string;
      descrizEN?: string;
      importo_netto: number;
      importo_iva: number;
      aliquota_iva?: number;
      cod_iva?: string;
    }>;
  }): Promise<Invoice> {
    const res = await http<ApiEnvelope<Invoice>>(
      `/api_invoices_crud?op=create`,
      {
        method: "POST",
        body,
      },
    );
    return res.data;
  },

  /**
   * Creación de una factura PASIVA (proveedor) con su distribución de coste
   * (quotes, DIV-12) y el número EXTERNO del proveedor (numero_alfanum, DIV-13).
   * Backend: Supplier_Invoice_Controller op=create (register_supplier_invoice).
   */
  async createSupplier(body: {
    id_anagrafica: number;
    data_fattura: string;
    numero_alfanum?: string;
    importo_netto: number;
    importo_iva: number;
    valuta_sigla?: string;
    quotes?: Array<{
      anno: number;
      importo_netto: number;
      id_piano_conto: number;
    }>;
  }): Promise<Invoice> {
    const res = await http<ApiEnvelope<Invoice>>(
      `/api_supplier_invoices?op=create`,
      {
        method: "POST",
        body,
      },
    );
    return res.data;
  },

  /**
   * Generación batch de facturas desde spedizioni. El backend envuelve la
   * respuesta en `{success, data:{generated, errors, summary}}`.
   */
  async generateBatch(body: Record<string, unknown>): Promise<{
    generated: Array<{
      id_fattura?: number;
      numero?: string;
      importo_netto?: number;
    }>;
    errors: unknown[];
    skipped: unknown[];
    diagnostics: BillableDiagnostic[];
    summary?: { total_invoices?: number; total_errors?: number };
  }> {
    const res = await http<{
      success: boolean;
      data?: {
        generated?: Array<{
          id_fattura?: number;
          numero?: string;
          importo_netto?: number;
        }>;
        errors?: unknown[];
        skipped?: unknown[];
        diagnostics?: BillableDiagnostic[];
        summary?: { total_invoices?: number; total_errors?: number };
      };
    }>(`/api_invoice_generate?op=generate`, { method: "POST", body });
    return {
      generated: res.data?.generated ?? [],
      errors: res.data?.errors ?? [],
      skipped: res.data?.skipped ?? [],
      diagnostics: res.data?.diagnostics ?? [],
      summary: res.data?.summary,
    };
  },
};
