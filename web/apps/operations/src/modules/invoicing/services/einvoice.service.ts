/**
 * einvoice.service — Documentos fiscales y estado SDI. Consume los Web_*:
 *   - PDF binario (api_invoice_pdf?format=pdf)
 *   - e-invoice país (api_invoice_einvoice — IT XML / NL JSON SnelStart)
 *   - estado SDI + timeline (api_invoice_sdi_status)
 *   - nota de crédito (api_credit_notes)
 */
import { http } from "./http";
import type { CreditRemaining } from "./creditNote.logic";

export interface PdfResult {
  invoice_id: number;
  file_name: string;
  mime_type: string;
  base_64: string;
}

export interface EInvoiceDoc {
  invoice_id: number;
  country: string;
  filename: string;
  mime_type?: string;
  content?: string;
  document?: string;
  validation: { valid: boolean; errors: string[] };
  /** Avisos no bloqueantes del builder (ej. EndpointID Peppol asumido por formato). */
  warnings?: string[];
}

export interface TimelineEvent {
  at: string;
  type: string;
  label: string;
  meta: Record<string, unknown>;
}

export interface SdiStatus {
  invoice_id: number;
  stato_sdi: string;
  stato_label: string;
  valid_transitions: string[];
  locked: boolean;
  timeline: TimelineEvent[];
}

export const einvoiceService = {
  /** PDF binario (base64). */
  pdf(id: number) {
    return http<PdfResult>(`/api_invoice_pdf?id=${id}&format=pdf`);
  },

  /** Documento e-invoice del país emisor, para descarga. */
  einvoice(id: number) {
    return http<EInvoiceDoc>(`/api_invoice_einvoice?id=${id}&download=1`);
  },

  /** Estado SDI + timeline + flag locked. */
  sdiStatus(id: number, signal?: AbortSignal) {
    return http<SdiStatus>(`/api_invoice_sdi_status?id=${id}`, { signal });
  },

  /** Transmite por el canal del país (IT=SDI, NL file=export). */
  transmit(id: number) {
    return http<{ state: string; reference: string; mode?: string }>(
      `/api_invoice_einvoice?op=transmit`,
      {
        method: "POST",
        body: { id, transmit: 1 },
      },
    );
  },

  /** Importes ya acreditados / pendientes de acreditar de una factura. */
  async creditRemaining(invoiceId: number): Promise<CreditRemaining> {
    const r = await http<{ data?: CreditRemaining } & Partial<CreditRemaining>>(
      `/api_credit_notes`,
      { query: { remaining_for: invoiceId } },
    );
    const d = (r.data ?? r) as CreditRemaining;
    return {
      original_netto: Number(d.original_netto ?? 0),
      original_iva: Number(d.original_iva ?? 0),
      credited_netto: Number(d.credited_netto ?? 0),
      credited_iva: Number(d.credited_iva ?? 0),
      remaining_netto: Number(d.remaining_netto ?? 0),
      remaining_iva: Number(d.remaining_iva ?? 0),
    };
  },

  /** Crea una nota de crédito (TD04) con motivo validado. */
  createCreditNote(
    originalInvoiceId: number,
    items: unknown[],
    motivo: string,
    note?: string,
  ) {
    return http<{ id: number }>(`/api_credit_notes?op=create`, {
      method: "POST",
      body: {
        original_invoice_id: originalInvoiceId,
        items,
        motivo,
        ...(note && note.trim() ? { note: note.trim() } : {}),
      },
    });
  },

  /**
   * Remedia una factura RECHAZADA por SDI (stato_sdi='K'): emite una nota de
   * crédito TD04 que la anula + reasigna sus expediciones. Backend copia las
   * líneas de la original (no requiere items).
   */
  remediateRejected(originalInvoiceId: number, motivo = "errore") {
    return http<{ data?: { id: number } }>(`/api_credit_notes?op=create`, {
      method: "POST",
      body: { original_invoice_id: originalInvoiceId, remediate: 1, motivo },
    });
  },
};

/** Convierte un base64 en descarga de fichero en el navegador. */
export function downloadBase64(
  base64: string,
  filename: string,
  mime = "application/octet-stream",
): void {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  triggerDownload(URL.createObjectURL(blob), filename);
}

/** Convierte texto plano (XML/JSON) en descarga de fichero. */
export function downloadText(
  text: string,
  filename: string,
  mime = "application/octet-stream",
): void {
  const blob = new Blob([text], { type: mime });
  triggerDownload(URL.createObjectURL(blob), filename);
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
