/** Cliente http del módulo warehouse (mismo origen que facturación). */
import { createHttpClient } from "@tmwe/shared-frontend/http";

function basePath(): string {
  return (
    (typeof window !== "undefined" && window.__TMWE_INVOICING__?.basePath) ||
    "/bff/v1"
  );
}

export const http = createHttpClient({ basePath, loginUrl: "/erp/" });
