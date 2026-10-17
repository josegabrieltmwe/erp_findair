import { ofetch, type $Fetch } from 'ofetch';
import { ApiError } from './ApiError';
import { redirectToBffLogin } from './bff';

/**
 * HTTP layer shared by cargo_express / shipment_express / home / admin_config.
 *
 * Each app calls {@link createHttpClient} with its own base-path resolver and
 * login redirect target. Behavior previously duplicated across apps:
 *   - distinguishes "session expired" (401 without oauth_required) from
 *     "endpoint requires Bearer token" (401 with oauth_required) — only the
 *     first triggers a logout redirect
 *   - emits typed events for unauthorized / forbidden / rate-limit / server-error
 *   - wraps non-2xx into {@link ApiError} with parsed message and error_code
 *
 * Single source of truth — see plan_paridad_spedyc_form_v2.md § TR-1.
 */

export type HttpEvent =
  | 'rate-limit'
  | 'forbidden'
  | 'server-error'
  | 'unauthorized'
  | 'network-error'
  // Activity events for a global "working…" indicator. `request-start` fires
  // when a request goes out, `request-end` when it settles (success or error).
  // A subscriber that counts start − end knows if any AJAX is in flight.
  | 'request-start'
  | 'request-end';

export type HttpListener = (event: HttpEvent, payload?: unknown) => void;

export interface HttpClientOptions {
  /** Resolves the base URL at call time (lets the app read window globals). */
  basePath: () => string;
  /** Redirect target on session expiry. Defaults to '/erp/'. */
  loginUrl?: string;
}

const listeners = new Set<HttpListener>();

export function onHttpEvent(listener: HttpListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: HttpEvent, payload?: unknown): void {
  for (const l of listeners) {
    try {
      l(event, payload);
    } catch {
      /* swallow listener errors so one bad subscriber can't break http */
    }
  }
}

/**
 * True while the browser is tearing down the page (navigation, reload, tab
 * close). Any in-flight request is cancelled by the browser at that point and
 * the resulting error is noise, not a failure worth showing.
 *
 * Tracked explicitly because the cancellation is indistinguishable from a real
 * network drop by looking at the error alone: ofetch reports both as
 * `FetchError … <no response> NetworkError when attempting to fetch resource`.
 */
let unloading = false;

if (typeof window !== 'undefined') {
  // `pagehide` covers the bfcache case that `beforeunload` misses, and both
  // fire before the fetch rejection lands.
  const markUnloading = (): void => {
    unloading = true;
  };
  window.addEventListener('pagehide', markUnloading);
  window.addEventListener('beforeunload', markUnloading);
  // Restored from bfcache: the page is alive again, so real errors must show.
  window.addEventListener('pageshow', () => {
    unloading = false;
  });
}

/** True if the page is being unloaded (see {@link isAbortLikeError}). */
export function isPageUnloading(): boolean {
  return unloading;
}

/**
 * Should this error be swallowed instead of shown to the user?
 *
 * Three cases, all of them "the request was cancelled on purpose":
 *  1. The caller aborted it (a newer fetch superseded this one). Check the
 *     signal, NOT `err.name`: ofetch wraps the DOMException in a FetchError,
 *     so the name reads 'FetchError' and the usual `name === 'AbortError'`
 *     test silently never matches.
 *  2. A raw (non-ofetch) AbortError.
 *  3. The browser cancelled it because the page is going away — the case that
 *     produced the `<no response> NetworkError` alert flashing on navigation.
 *
 * A genuine network failure (server down, offline) is NOT abort-like and must
 * still surface.
 */
export function isAbortLikeError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  const name = (err as { name?: string } | null)?.name;
  if (name === 'AbortError') return true;
  return unloading;
}

/**
 * User-facing message for a failed request.
 *
 * ofetch's own message is a diagnostic dump —
 * `[GET] "/bff/v1/api_courier_shipments?page=1&…": <no response>
 * NetworkError when attempting to fetch resource.` — which is unreadable in a
 * UI alert. For a connection failure return the caller's translated fallback;
 * for anything else (an ApiError carrying a parsed server message) keep the
 * real text, which is actionable.
 *
 * @param fallback Translated "could not reach the server" copy.
 */
export function toUserMessage(err: unknown, fallback: string): string {
  const e = err as { name?: string; response?: unknown; message?: string } | null;
  // No response at all → transport-level failure, message is noise.
  if (e?.name === 'FetchError' && !e.response) return fallback;
  return e?.message || fallback;
}

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as { error?: unknown; message?: unknown; detail?: unknown; title?: unknown };
  if (typeof o.error === 'string') return o.error;
  if (typeof o.message === 'string') return o.message;
  // RFC 9457 (errores propios del BFF)
  if (typeof o.detail === 'string') return o.detail;
  if (typeof o.title === 'string') return o.title;
  return null;
}

/**
 * Idioma activo de la UI (el que guarda el LanguageSwitcher en
 * `tmwe.locale`). Se manda al servidor en `X-Tmwe-Lang` para que los textos
 * que genera él (estados, etiquetas) coincidan con el idioma de la interfaz
 * en vez del de la cuenta/sesión.
 */
function activeLocale(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('tmwe.locale') : null;
  } catch {
    return null; // storage bloqueado (modo privado): el servidor usa su idioma
  }
}

/** Con el BFF no hay URL de login configurable por app: siempre `/bff/auth/login`. */
function redirectToLogin(_url?: string): void {
  redirectToBffLogin();
}

/**
 * Build an ofetch instance with the shared interceptors. Each app gets its
 * own instance (different basePath) but shares the event bus.
 */
export function createHttpClient(opts: HttpClientOptions): $Fetch {
  const loginUrl = opts.loginUrl ?? '/erp/';

  return ofetch.create({
    baseURL: opts.basePath(),
    credentials: 'include',
    retry: 0,
    onRequest({ options }) {
      options.headers = new Headers(options.headers);
      if (!options.headers.has('Accept')) options.headers.set('Accept', 'application/json');
      const lang = activeLocale();
      if (lang && !options.headers.has('X-Tmwe-Lang')) options.headers.set('X-Tmwe-Lang', lang);
      if (
        options.body &&
        !options.headers.has('Content-Type') &&
        typeof options.body === 'object'
      ) {
        options.headers.set('Content-Type', 'application/json');
      }
      emit('request-start');
    },
    onResponse() {
      // Fires for every settled response (including non-2xx that didn't throw).
      emit('request-end');
    },
    onRequestError({ error }) {
      // Network failure before a response — still close the activity counter.
      emit('request-end');
      // Only a *real* failure is worth announcing: an abort (newer request, or
      // the page unloading) is expected and must stay silent.
      if (!isAbortLikeError(error)) {
        emit('network-error', error);
      }
    },
    onResponseError({ response }) {
      const status = response?.status ?? 0;
      if (status === 401) {
        const body = response?._data as { error?: string; error_code?: string } | undefined;
        const looksLikeBearerOnly =
          body?.error === 'oauth_required' || body?.error_code === 'OAUTH_REQUIRED';
        if (!looksLikeBearerOnly) {
          emit('unauthorized');
          redirectToLogin(loginUrl);
        }
        throw new ApiError(
          looksLikeBearerOnly ? 'Endpoint requires Bearer token' : 'Session expired',
          401,
          looksLikeBearerOnly ? 'OAUTH_REQUIRED' : 'UNAUTHORIZED',
        );
      }
      if (status === 403) {
        emit('forbidden', response?._data);
        throw new ApiError(
          extractMessage(response?._data) || 'Forbidden',
          403,
          'FORBIDDEN',
          response?._data,
        );
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
}

/**
 * Global window.fetch interceptor. Same logic as createHttpClient's 401
 * handler but applies to third-party fetch calls (e.g. raw fetch inside
 * @tmwe/platform components). Kept for backward compat — TR-2 will remove
 * this once @tmwe/platform migrates to the createHttpClient instance.
 *
 * @deprecated migrate callers to createHttpClient — see plan v2 TR-2.
 */
export function installFetchInterceptor(loginUrl = '/erp/'): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __tmweFetchInstalled?: boolean };
  if (w.__tmweFetchInstalled) return;
  w.__tmweFetchInstalled = true;
  const original = window.fetch.bind(window);
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const res = await original(...args);
    if (res.status === 401) {
      const looksLikeBearerOnly = await peekOauthRequired(res);
      if (!looksLikeBearerOnly) {
        emit('unauthorized');
        redirectToLogin(loginUrl);
      }
    }
    return res;
  };
}

async function peekOauthRequired(res: Response): Promise<boolean> {
  try {
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return false;
    const clone = res.clone();
    const body = (await clone.json()) as { error?: string; error_code?: string };
    return body?.error === 'oauth_required' || body?.error_code === 'OAUTH_REQUIRED';
  } catch {
    return false;
  }
}

export { ApiError } from './ApiError';
export { resolveBasePath, DEFAULT_BASE_PATH } from './base_path';
export * from './bff';
