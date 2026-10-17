/**
 * Per-app http client de la SPA de facturación. Delega interceptor/eventos en
 * `@tmwe/shared-frontend/http`; lo único propio es el basePath, leído de
 * `window.__TMWE_INVOICING__`.
 */
import {
  createHttpClient,
  installFetchInterceptor as installSharedFetchInterceptor,
  onHttpEvent as onSharedHttpEvent,
} from "@tmwe/shared-frontend/http";

function basePath(): string {
  return (
    (typeof window !== "undefined" && window.__TMWE_INVOICING__?.basePath) ||
    "/bff/v1"
  );
}

export const http = createHttpClient({ basePath, loginUrl: "/erp/" });
export const onHttpEvent = onSharedHttpEvent;
export function installFetchInterceptor(): void {
  installSharedFetchInterceptor("/erp/");
}

import type { InvoicingCapabilities } from "../env";

/** Audiencia actual (operador/partner) para ocultar acciones de escritura. */
export function audience(): "operator" | "partner" {
  return window.__TMWE_INVOICING__?.audience === "partner"
    ? "partner"
    : "operator";
}

export function isPartner(): boolean {
  return audience() === "partner";
}

const DEFAULT_CAPS: InvoicingCapabilities = {
  canRead: true,
  canWrite: false,
  canSend: false,
  canExport: true,
  canAdminNumbering: false,
};

/**
 * Capacidades efectivas del usuario (inyectadas por el wrapper PHP desde los
 * permisos reales). La UI las usa para mostrar SOLO las acciones que el backend
 * autorizará — el bloqueo real lo hace Authz_Service en el servidor.
 */
export function capabilities(): InvoicingCapabilities {
  return window.__TMWE_INVOICING__?.capabilities ?? DEFAULT_CAPS;
}

export const can = {
  read: (): boolean => capabilities().canRead,
  write: (): boolean => capabilities().canWrite,
  send: (): boolean => capabilities().canSend,
  export: (): boolean => capabilities().canExport,
  /**
   * Configurar las series de numeración del propio partner. Cae a canWrite si
   * el wrapper PHP aún no inyecta la capability (despliegues escalonados).
   */
  adminNumbering: (): boolean =>
    capabilities().canAdminNumbering ?? capabilities().canWrite,
};
