/**
 * supplierInvoice.service — facturas recibidas (de proveedor). Endpoint
 * `api_supplier_invoices` (Web_* wrapper):
 *   GET                         listado con filtros
 *   PUT                         {id, controllo_stato}  estado de control
 *   POST ?op=import_xml_preview FatturaPA en bruto (multipart `xml`) → revisión
 *   POST ?op=import_xml         multipart `xml` + `id_anagrafica` → crea la factura
 *   GET  ?op=suppliers          selector de proveedor/transportista utilizable
 *   POST                        alta manual {id_anagrafica, data_fattura, ...}
 *   PUT                         {id, shipment_ids | cargo_shipment_ids}  vincula expediciones
 */
import { http } from "./http";

/** N sin controlar · S controlada y pagable · R a revisar. */
export type ControlState = "N" | "S" | "R";
export const CONTROL_STATES: ControlState[] = ["N", "S", "R"];

export interface SupplierInvoiceItem {
  id: number | string;
  numero?: string | number;
  numero_alfanum?: string;
  data_fattura: string;
  importo_netto: number | string;
  importo_iva: number | string;
  valuta_sigla?: string;
  id_anagrafica?: number | string;
  rag_soc?: string;
  stato_sdi?: string;
  controllo_stato?: ControlState | string | null;
  pagos?: import("./invoice.service").PaymentSummary | null;
}

export interface SupplierListFilters {
  data_da?: string;
  data_a?: string;
  numero?: string;
  id_anagrafica?: string | number;
  stato_sdi?: string;
  controllo_stato?: string;
  search?: string;
  stato_pagamento?: string;
  page?: number;
  per_page?: number;
}

export interface XmlLine {
  descrizione?: string;
  quantita?: number | string;
  prezzo_unitario?: number | string;
  prezzo_totale?: number | string;
  aliquota_iva?: number | string;
  [k: string]: unknown;
}
export interface XmlVatSummary {
  aliquota_iva?: number | string;
  imponibile?: number | string;
  imposta?: number | string;
  [k: string]: unknown;
}
export interface XmlAttachment {
  nome?: string;
  name?: string;
  [k: string]: unknown;
}
export interface SupplierCandidate {
  id: number;
  rag_soc: string;
  pi_cf?: string;
  cf?: string;
}
export interface PaymentsPlanItem {
  scadenza: string;
  importo: number | string;
  modalita?: string;
}
export interface ImportPreview {
  tipo_documento?: string;
  is_credit_note?: boolean;
  numero?: string;
  data?: string;
  divisa?: string;
  importo_totale?: number | string;
  imponibile?: number | string;
  imposta?: number | string;
  supplier?: {
    denominazione?: string;
    pi_cf?: string;
    pi_cf_full?: string;
    cf?: string;
    paese?: string;
  };
  righe?: XmlLine[];
  riepilogo?: XmlVatSummary[];
  pagamenti?: unknown[];
  causale?: string | string[];
  allegati?: XmlAttachment[];
  warnings?: string[];
  supplier_candidates?: SupplierCandidate[];
  duplicate_id?: number | null;
  blocking?: string[];
  payments_plan?: {
    source: "xml" | "default_schedule";
    items: PaymentsPlanItem[];
  };
}

export interface ImportResult {
  id: number;
  import?: { payments_created?: number; warnings?: string[] };
  [k: string]: unknown;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  pagination?: { total: number };
}

export const MAX_XML_BYTES = 5 * 1024 * 1024;

/** Valida el fichero antes de subirlo: tipo (.xml/.p7m) y tamaño (≤ 5 MB). */
export function validateXmlFile(
  file: { name: string; size: number } | null | undefined,
): "ok" | "missing" | "bad_type" | "too_big" {
  if (!file) return "missing";
  if (!/\.(xml|p7m)$/i.test(file.name)) return "bad_type";
  if (file.size > MAX_XML_BYTES) return "too_big";
  return "ok";
}

/** Solo manda los filtros con valor. */
export function buildSupplierListQuery(
  f: SupplierListFilters,
): Record<string, string | number> {
  const q: Record<string, string | number> = {};
  (Object.keys(f) as (keyof SupplierListFilters)[]).forEach((k) => {
    const v = f[k];
    if (v !== undefined && v !== null && v !== "") q[k] = v as string | number;
  });
  return q;
}

export type ImportErrorKind = "invalid" | "duplicate" | "other";

/** Clasifica un fallo de importación (422 XML no válido, 409 duplicada). */
export function classifyImportError(e: unknown): {
  kind: ImportErrorKind;
  message: string;
} {
  const err = e as {
    status?: number;
    errorCode?: string;
    message?: string;
  } | null;
  const message = err?.message ?? "";
  if (err?.status === 409) return { kind: "duplicate", message };
  if (err?.status === 422 && err.errorCode === "SUPPLIER_XML_INVALID") {
    return { kind: "invalid", message };
  }
  return { kind: "other", message };
}

/** La importación solo se confirma con proveedor elegido y sin bloqueos. */
export function canConfirmImport(
  preview: ImportPreview | null,
  supplierId: number | null,
): boolean {
  if (!preview || !supplierId) return false;
  if ((preview.blocking ?? []).length > 0) return false;
  if (preview.duplicate_id) return false;
  return (preview.supplier_candidates ?? []).some((c) => c.id === supplierId);
}

/** Proveedor preseleccionado: el único candidato, si lo hay. */
export function defaultSupplier(preview: ImportPreview | null): number | null {
  const c = preview?.supplier_candidates ?? [];
  return c.length === 1 ? c[0].id : null;
}

export const CONTROL_COLOR: Record<ControlState, string> = {
  N: "grey",
  S: "success",
  R: "warning",
};

export function controlStateOf(v: unknown): ControlState {
  return v === "S" || v === "R" ? v : "N";
}

function xmlForm(file: File, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.append("xml", file);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return form;
}

/** Proveedor o transportista que el llamante puede usar en una factura de proveedor. */
export interface SupplierOption {
  id: number;
  rag_soc: string;
  pi_cf: string;
  tipo: string;
}

export interface NewSupplierInvoice {
  id_anagrafica: number;
  data_fattura: string;
  numero_alfanum: string;
  importo_netto: number;
  importo_iva: number;
  valuta_sigla: string;
  descriz?: string;
}

export interface LinkResult {
  linked: number;
  already_linked: number;
  total_requested: number;
  errors: string[];
}

export type NewInvoiceCheck =
  | "ok"
  | "supplier"
  | "number"
  | "date"
  | "amount"
  | "currency";

/** Valida el alta manual antes de enviarla (el servidor vuelve a validar). */
export function validateNewSupplierInvoice(
  f: Partial<NewSupplierInvoice>,
): NewInvoiceCheck {
  if (!f.id_anagrafica || f.id_anagrafica <= 0) return "supplier";
  if (!f.numero_alfanum || !f.numero_alfanum.trim()) return "number";
  if (!f.data_fattura || !/^\d{4}-\d{2}-\d{2}$/.test(f.data_fattura)) {
    return "date";
  }
  if (
    f.importo_netto == null ||
    !Number.isFinite(f.importo_netto) ||
    f.importo_netto <= 0 ||
    (f.importo_iva != null &&
      (!Number.isFinite(f.importo_iva) || f.importo_iva < 0))
  ) {
    return "amount";
  }
  if (!f.valuta_sigla || !/^[A-Z]{3}$/.test(f.valuta_sigla)) return "currency";
  return "ok";
}

/** «101, 102 103\n104» → [101, 102, 103, 104]; sin repetidos ni valores no válidos. */
export function parseShipmentIds(text: string): number[] {
  const out: number[] = [];
  for (const part of (text ?? "").split(/[\s,;]+/)) {
    if (!/^\d+$/.test(part)) continue;
    const n = Number(part);
    if (n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

export const supplierInvoiceApi = {
  async list(
    filters: SupplierListFilters,
    signal?: AbortSignal,
  ): Promise<{ items: SupplierInvoiceItem[]; total: number }> {
    const res = await http<Envelope<SupplierInvoiceItem[]>>(
      "/api_supplier_invoices",
      { query: buildSupplierListQuery(filters), signal },
    );
    const items = Array.isArray(res.data) ? res.data : [];
    return { items, total: res.pagination?.total ?? items.length };
  },

  async setControlState(id: number, state: ControlState): Promise<void> {
    await http("/api_supplier_invoices", {
      method: "PUT",
      body: { id, controllo_stato: state },
    });
  },

  async importPreview(file: File): Promise<ImportPreview> {
    const res = await http<Envelope<ImportPreview>>("/api_supplier_invoices", {
      method: "POST",
      query: { op: "import_xml_preview" },
      body: xmlForm(file),
    });
    return res.data;
  },

  async importXml(file: File, idAnagrafica: number): Promise<ImportResult> {
    const res = await http<Envelope<ImportResult>>("/api_supplier_invoices", {
      method: "POST",
      query: { op: "import_xml" },
      body: xmlForm(file, { id_anagrafica: String(idAnagrafica) }),
    });
    return res.data;
  },
  async suppliers(search: string, perPage = 25): Promise<SupplierOption[]> {
    const query: Record<string, string | number> = {
      op: "suppliers",
      per_page: perPage,
    };
    if (search.trim()) query.search = search.trim();
    const res = await http<Envelope<SupplierOption[]>>(
      "/api_supplier_invoices",
      { query },
    );
    return Array.isArray(res.data) ? res.data : [];
  },

  /** Alta manual de la factura del transportista (devuelve su id). */
  async create(body: NewSupplierInvoice): Promise<number> {
    const res = await http<Envelope<{ id?: number; id_fattura?: number }>>(
      "/api_supplier_invoices",
      { method: "POST", body },
    );
    return Number(res.data?.id ?? res.data?.id_fattura ?? 0);
  },

  /** Vincula expediciones (express o cargo) a la factura de proveedor. */
  async linkShipments(
    id: number,
    shipmentIds: number[],
    kind: "express" | "cargo",
  ): Promise<LinkResult> {
    const res = await http<Envelope<LinkResult>>("/api_supplier_invoices", {
      method: "PUT",
      body: {
        id,
        [kind === "cargo" ? "cargo_shipment_ids" : "shipment_ids"]: shipmentIds,
      },
    });
    return {
      linked: Number(res.data?.linked ?? 0),
      already_linked: Number(res.data?.already_linked ?? 0),
      total_requested: Number(res.data?.total_requested ?? 0),
      errors: Array.isArray(res.data?.errors) ? res.data.errors : [],
    };
  },
};
