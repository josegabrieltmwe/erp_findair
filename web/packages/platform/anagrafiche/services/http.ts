import { ofetch, type FetchOptions, type FetchResponse } from 'ofetch';
import { ApiError } from './api.types';
import { withPresenceHeaders } from '../../presence/presence';
import { redirectToBffLogin } from '@tmwe/shared-frontend/http';

function basePath(): string {
  // `__TMWE_NAV__` lo inyecta cada plantilla de página (Abstract_Vite_Template).
  // Cast local para no depender de una declaración global por-app: este módulo
  // vive en @shared y lo consumen varias apps con distintos tsconfig.
  if (typeof window === 'undefined') return '';
  const nav = (window as unknown as { __TMWE_NAV__?: { basePath?: string } }).__TMWE_NAV__;
  return nav?.basePath || '';
}

// Con el BFF el navegador no tiene tokens que renovar: el BFF refresca en el servidor.
async function tryRefreshToken(): Promise<boolean> {
  return false;
}

function redirectToLogout(): void {
  redirectToBffLogin();
}

/**
 * Listener pattern for cross-cutting events (rate-limit, auth, server errors)
 * so toasts/stores can react without circular imports.
 */
type HttpEvent = 'rate-limit' | 'forbidden' | 'server-error' | 'unauthorized' | 'network-error';
type HttpListener = (event: HttpEvent, payload?: unknown) => void;

const listeners = new Set<HttpListener>();
export function onHttpEvent(listener: HttpListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function emit(event: HttpEvent, payload?: unknown): void {
  for (const l of listeners) {
    try {
      l(event, payload);
    } catch {
      /* swallow listener errors */
    }
  }
}

export const http = ofetch.create({
  credentials: 'include',
  retry: 0,
  onRequest({ options }) {
    // Resolver baseURL POR PETICIÓN, no al crear el cliente: en algunas apps
    // (p. ej. partner_clients) el global __TMWE_NAV__ se establece en main.ts
    // DESPUÉS de importar este módulo, así que fijarlo en create() daría ''.
    if (!options.baseURL) {
      options.baseURL = basePath();
    }
    options.headers = new Headers(options.headers);
    if (!options.headers.has('Accept')) options.headers.set('Accept', 'application/json');
    // No forzar JSON en uploads: FormData debe llevar multipart/form-data con
    // su boundary, que el navegador fija solo si NO se toca el Content-Type.
    const isFormData =
      typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (
      options.body &&
      !isFormData &&
      !options.headers.has('Content-Type') &&
      typeof options.body === 'object'
    ) {
      options.headers.set('Content-Type', 'application/json');
    }
  },
  async onResponseError({ response, request, options }) {
    const status = response?.status ?? 0;
    if (status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        // Retry the original request once after a successful refresh.
        const retryOptions: FetchOptions = { ...options, retry: 0 };
        const retryRes = (await ofetch.raw(request as string, retryOptions)) as FetchResponse<unknown>;
        // Replace the response body in-place so the original caller sees the retry result.
        // ofetch will throw if retry also fails; here we trust the original request semantics.
        if (response) {
          (response as unknown as { _data: unknown })._data = retryRes._data;
          (response as unknown as { status: number }).status = retryRes.status;
        }
        return;
      }
      emit('unauthorized');
      redirectToLogout();
      throw new ApiError('Session expired', 401, 'UNAUTHORIZED');
    }
    if (status === 403) {
      emit('forbidden', response?._data);
      throw new ApiError(extractMessage(response?._data) || 'Forbidden', 403, 'FORBIDDEN', response?._data);
    }
    if (status === 429) {
      emit('rate-limit', response?._data);
      throw new ApiError(
        extractMessage(response?._data) || 'Too many requests',
        429,
        'RATE_LIMIT',
        response?._data,
      );
    }
    if (status >= 500) {
      emit('server-error', response?._data);
      throw new ApiError(
        extractMessage(response?._data) || 'Server error',
        status,
        'SERVER_ERROR',
        response?._data,
      );
    }
    // 4xx client errors → propagate as ApiError with body details
    if (status >= 400) {
      throw new ApiError(
        extractMessage(response?._data) || 'Request failed',
        status,
        (response?._data as { error_code?: string })?.error_code,
        response?._data,
      );
    }
  },
});

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as { error?: unknown; message?: unknown };
  if (typeof o.error === 'string') return o.error;
  if (typeof o.message === 'string') return o.message;
  return null;
}

/**
 * Global fetch interceptor — preserves the legacy V1 behaviour: any HTTP 401
 * response from any code path (not just our http client) redirects to logout.
 * Required because Vuetify or other third-party code may call fetch directly.
 *
 * Also tags every same-origin request with the tab's presence instance id
 * (`X-Client-Instance`, see presence/presence.ts). ofetch resolves
 * `globalThis.fetch` per call, so the shared http clients go through here too.
 */
export function installFetchInterceptor(): void {
  if (typeof window === 'undefined' || (window as unknown as { __cmFetchInstalled?: boolean }).__cmFetchInstalled) {
    return;
  }
  (window as unknown as { __cmFetchInstalled?: boolean }).__cmFetchInstalled = true;
  const original = window.fetch.bind(window);
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    args[1] = withPresenceHeaders(args[0], args[1]);
    const res = await original(...args);
    if (res.status === 401 && shouldHandle401(args[0])) {
      const refreshed = await tryRefreshToken();
      if (!refreshed) redirectToLogout();
    }
    return res;
  };
}

function shouldHandle401(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  // Don't recurse on the refresh token call itself.
  if (url.endsWith('/token')) return false;
  // Fire-and-forget telemetry must never trigger logout — it can race with
  // real navigation, refreshes, etc. Loss of one hit is acceptable.
  if (url.includes('/api_admin_config_section_usage')) return false;
  // Same for the presence heartbeat: an expired session is noticed by the
  // next real request, not by a background beat (or the pagehide beacon).
  if (url.includes('/web_presence_heartbeat')) return false;
  return true;
}
