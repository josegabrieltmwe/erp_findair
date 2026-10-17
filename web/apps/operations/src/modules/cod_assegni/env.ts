/**
 * Capacidades del módulo COD. Sin bloque propio se derivan de las de
 * facturación (`__TMWE_INVOICING__`); un bloque opcional `__TMWE_COD__` tiene
 * prioridad. El partner es siempre de solo lectura.
 */
import type { TmweInvoicingBootstrap } from "../invoicing/env";

export interface CodCapabilities {
  canRead: boolean;
  /** Marcar cobros, asignar remesas. */
  canWrite: boolean;
}

export interface TmweCodBootstrap {
  capabilities?: Partial<CodCapabilities>;
}

declare global {
  interface Window {
    __TMWE_COD__?: TmweCodBootstrap;
  }
}

export function capabilities(): CodCapabilities {
  if (typeof window === "undefined") return { canRead: true, canWrite: false };
  const inv: TmweInvoicingBootstrap | undefined = window.__TMWE_INVOICING__;
  if (inv?.audience === "partner") return { canRead: true, canWrite: false };
  const derived: CodCapabilities = {
    canRead: inv?.capabilities?.canRead ?? true,
    canWrite: inv?.capabilities?.canWrite ?? false,
  };
  return { ...derived, ...(window.__TMWE_COD__?.capabilities ?? {}) };
}

export const can = {
  read: (): boolean => capabilities().canRead,
  write: (): boolean => capabilities().canWrite,
};
