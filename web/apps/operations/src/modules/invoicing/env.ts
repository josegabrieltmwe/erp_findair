/**
 * Tipos de bootstrap del módulo invoicing (ex-apps/invoicing/src/env.d.ts).
 * Se conserva el global propio `__TMWE_INVOICING__` porque invoicing tiene
 * capacidades/audiencia específicas (operador vs partner) que el bootstrap
 * genérico de operations no modela. El template PHP puede inyectar ambos.
 */

/** Audiencia que sirve la SPA: operador interno o partner B2B (solo lectura). */
export type InvoicingAudience = "operator" | "partner";

/** Capacidades efectivas del usuario sobre el módulo de facturación. */
export interface InvoicingCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canSend: boolean;
  canExport: boolean;
  /** Configurar las series de numeración del propio partner. */
  canAdminNumbering?: boolean;
}

/** Payload inyectado por el wrapper PHP para el módulo invoicing. */
export interface TmweInvoicingBootstrap {
  invoiceId: number | null;
  isNew: boolean;
  basePath: string;
  language: string | null;
  audience: InvoicingAudience;
  capabilities: InvoicingCapabilities;
  csrf?: string | null;
}

declare global {
  interface Window {
    __TMWE_INVOICING__?: TmweInvoicingBootstrap;
  }
}
