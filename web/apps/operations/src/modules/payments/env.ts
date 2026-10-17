/**
 * Bootstrap y capacidades del módulo payments. No hay un global propio: la
 * audiencia y los permisos se heredan del bootstrap de facturación
 * (`__TMWE_INVOICING__`) y, si el wrapper PHP los inyecta, de un bloque
 * opcional `__TMWE_PAYMENTS__` que tiene prioridad.
 */
import type {
  InvoicingAudience,
  TmweInvoicingBootstrap,
} from "../invoicing/env";

/** Capacidades efectivas del usuario sobre cobros y pagos. */
export interface PaymentsCapabilities {
  canRead: boolean;
  /** Registrar, reabrir y cerrar en lote cobros. */
  canCollect: boolean;
  /** Importar extractos bancarios y confirmar conciliaciones. */
  canReconcile: boolean;
}

export interface TmwePaymentsBootstrap {
  audience?: InvoicingAudience;
  capabilities?: Partial<PaymentsCapabilities>;
}

declare global {
  interface Window {
    __TMWE_PAYMENTS__?: TmwePaymentsBootstrap;
  }
}

const READ_ONLY: PaymentsCapabilities = {
  canRead: true,
  canCollect: false,
  canReconcile: false,
};

function bootstrapOf(): {
  inv?: TmweInvoicingBootstrap;
  pay?: TmwePaymentsBootstrap;
} {
  if (typeof window === "undefined") return {};
  return { inv: window.__TMWE_INVOICING__, pay: window.__TMWE_PAYMENTS__ };
}

export function audience(): InvoicingAudience {
  const { inv, pay } = bootstrapOf();
  return (pay?.audience ?? inv?.audience) === "partner"
    ? "partner"
    : "operator";
}

export function isPartner(): boolean {
  return audience() === "partner";
}

/**
 * Capacidades efectivas. El partner es siempre de solo lectura. Para el
 * operador, sin bloque propio se derivan de las de facturación: quien puede
 * escribir facturas puede cobrar y conciliar.
 */
export function capabilities(): PaymentsCapabilities {
  if (isPartner()) return { ...READ_ONLY };
  const { inv, pay } = bootstrapOf();
  const invCaps = inv?.capabilities;
  const derived: PaymentsCapabilities = {
    canRead: invCaps?.canRead ?? true,
    canCollect: invCaps?.canWrite ?? false,
    canReconcile: invCaps?.canWrite ?? false,
  };
  return { ...derived, ...(pay?.capabilities ?? {}) };
}

export const can = {
  read: (): boolean => capabilities().canRead,
  collect: (): boolean => capabilities().canCollect,
  reconcile: (): boolean => capabilities().canReconcile,
};
