/**
 * Bootstrap y capacidades del módulo warehouse. Sin global propio: la
 * audiencia y los permisos se heredan del bootstrap de facturación
 * (`__TMWE_INVOICING__`) y, si el wrapper PHP lo inyecta, de un bloque
 * opcional `__TMWE_WAREHOUSE__` que tiene prioridad. El partner es siempre
 * de solo lectura.
 */
import type {
  InvoicingAudience,
  TmweInvoicingBootstrap,
} from "../invoicing/env";

export interface WarehouseCapabilities {
  canRead: boolean;
  /** Pesar, asociar, cargar autistas, firmar entregas y generar manifiestos. */
  canWrite: boolean;
}

export interface TmweWarehouseBootstrap {
  audience?: InvoicingAudience;
  capabilities?: Partial<WarehouseCapabilities>;
}

declare global {
  interface Window {
    __TMWE_WAREHOUSE__?: TmweWarehouseBootstrap;
  }
}

function bootstrapOf(): {
  inv?: TmweInvoicingBootstrap;
  wh?: TmweWarehouseBootstrap;
} {
  if (typeof window === "undefined") return {};
  return { inv: window.__TMWE_INVOICING__, wh: window.__TMWE_WAREHOUSE__ };
}

export function isPartner(): boolean {
  const { inv, wh } = bootstrapOf();
  return (wh?.audience ?? inv?.audience) === "partner";
}

export function capabilities(): WarehouseCapabilities {
  if (isPartner()) return { canRead: true, canWrite: false };
  const { inv, wh } = bootstrapOf();
  const derived: WarehouseCapabilities = {
    canRead: inv?.capabilities?.canRead ?? true,
    canWrite: inv?.capabilities?.canWrite ?? false,
  };
  return { ...derived, ...(wh?.capabilities ?? {}) };
}

export const can = {
  read: (): boolean => capabilities().canRead,
  write: (): boolean => capabilities().canWrite,
};
