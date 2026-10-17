/**
 * Integración con el BFF (token handler).
 *
 * El navegador no ve tokens OAuth: solo una cookie de sesión HttpOnly. Este módulo:
 *   - fija la base de la API (`/bff/v1`),
 *   - añade `X-CSRF-Token` a toda petición que cambia estado hacia `/bff/`,
 *   - manda al login del BFF cuando la sesión no existe o caduca,
 *   - arranca la sesión (`bootstrapBff`) y rellena los globales que antes inyectaba PHP.
 */

export const BFF_BASE_PATH = '/bff/v1';
const BFF_AUTH_PATH = '/bff/auth';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let csrfToken: string | null = null;
let redirecting = false;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/** URL del login del BFF; vuelve a la página actual (solo ruta relativa, el BFF la valida). */
export function bffLoginUrl(returnTo?: string): string {
  const here =
    typeof window !== 'undefined'
      ? window.location.pathname + window.location.search + window.location.hash
      : '/';
  return `${BFF_AUTH_PATH}/login?return_to=${encodeURIComponent(returnTo ?? here)}`;
}

export function redirectToBffLogin(): void {
  if (typeof window === 'undefined' || redirecting) return;
  redirecting = true;
  window.location.assign(bffLoginUrl());
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isBffRequest(input: RequestInfo | URL): boolean {
  try {
    const url = new URL(requestUrl(input), window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/bff/');
  } catch {
    return false;
  }
}

/**
 * Envuelve `window.fetch` (ofetch lo resuelve en cada llamada, así que cubre también
 * las peticiones `fetch()` directas de los componentes).
 */
export function installBffFetch(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __bffFetchInstalled?: boolean };
  if (w.__bffFetchInstalled) return;
  w.__bffFetchInstalled = true;

  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isBffRequest(input)) return original(input, init);

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    let next = init;
    if (!SAFE_METHODS.has(method) && csrfToken) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrfToken);
      next = { ...init, headers };
    }
    const response = await original(input, { credentials: 'same-origin', ...next });

    if (response.status === 401 && !requestUrl(input).includes('/bff/auth/')) {
      redirectToBffLogin();
    }
    return response;
  };
}

/** Cierra la sesión en el BFF (revoca tokens y destruye la sesión) y vuelve al inicio. */
export async function bffLogout(): Promise<void> {
  try {
    await fetch(`${BFF_AUTH_PATH}/logout`, { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.assign('/');
  }
}

export interface BffSession {
  authenticated: boolean;
  csrf_token?: string;
  access_expires_at?: number;
}

interface Profile {
  language?: string | null;
  idanagfrc?: number | string | null;
  is_admin?: boolean;
}

/**
 * Comprueba la sesión y deja el entorno listo para que arranque la SPA.
 * Devuelve false si se ha redirigido al login (no hay que montar la app).
 */
export async function bootstrapBff(): Promise<boolean> {
  installBffFetch();

  const res = await fetch(`${BFF_AUTH_PATH}/session`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const session = (await res.json()) as BffSession;
  if (!session.authenticated || !session.csrf_token) {
    redirectToBffLogin();
    return false;
  }
  setCsrfToken(session.csrf_token);

  const profileRes = await fetch(`${BFF_BASE_PATH}/get_my_profile`, { headers: { Accept: 'application/json' } });
  const profile = (profileRes.ok ? await profileRes.json() : {}) as Profile;

  // El backend no expone aún las capacidades (authx_*) por API: se deduce de forma
  // conservadora; mostrar de menos es seguro, cada página sigue autorizando por su cuenta.
  const partnerId = Number(profile.idanagfrc ?? 0) || 0;
  const isTmwe = partnerId === 1;
  const language = (() => {
    try {
      return localStorage.getItem('tmwe.locale') ?? profile.language ?? null;
    } catch {
      return profile.language ?? null;
    }
  })();

  const w = window as unknown as Record<string, unknown>;
  w.__TMWE_NAV__ = { basePath: BFF_BASE_PATH };
  w.__TMWE_OPERATIONS__ = {
    basePath: BFF_BASE_PATH,
    language,
    csrf: session.csrf_token,
    isTmwe,
    partnerId,
    capabilities: isTmwe ? ['tmwe', 'clients'] : [],
  };
  return true;
}
