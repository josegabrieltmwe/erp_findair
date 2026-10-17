/**
 * Per-app http client. Delegates the interceptor/event logic to
 * `@tmwe/shared-frontend/http` (TR-2) — the only per-app concern is the
 * basePath, read from `window.__TMWE_CARGO__`.
 *
 * Consumers keep importing `{ http, onHttpEvent, installFetchInterceptor }`
 * from this module — the wiring inside is now a re-export.
 */
import {
  createHttpClient,
  installFetchInterceptor as installSharedFetchInterceptor,
  onHttpEvent as onSharedHttpEvent,
} from "@tmwe/shared-frontend/http";

function basePath(): string {
  return (
    (typeof window !== "undefined" && window.__TMWE_CARGO__?.basePath) ||
    "/bff/v1"
  );
}

export const http = createHttpClient({ basePath, loginUrl: "/erp/" });
export const onHttpEvent = onSharedHttpEvent;
export function installFetchInterceptor(): void {
  installSharedFetchInterceptor("/erp/");
}
