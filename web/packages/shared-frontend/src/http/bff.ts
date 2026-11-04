/**
 * Integración con el BFF (token handler).
 *
 * El navegador no ve tokens OAuth: solo una cookie de sesión HttpOnly. Este módulo:
 *   - fija la base de la API (`/bff/v1`),
 *   - añade `X-CSRF-Token` a toda petición que cambia estado hacia `/bff/`,
 *   - manda al login del BFF cuando la sesión no existe o caduca,
 *   - arranca la sesión (`bootstrapBff`) y rellena los globales que antes inyectaba PHP.
 */

import { authErrorFromSearch, renderAuthError } from './authError';
import { renderNoAccess } from './noAccess';

export const BFF_BASE_PATH = '/bff/v1';
const BFF_AUTH_PATH = '/bff/auth';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let csrfToken: string | null = null;
let redirecting = false;

/**
 * Indicador global de "procesando": cuenta las peticiones que cambian estado hacia `/bff/`
 * y avisa a los suscriptores (el modal del shell). Las rutas de `BUSY_IGNORED` y las
 * peticiones con `X-Busy: off` no lo activan (chat del copilot, que tiene su propio estado).
 */
export interface BusyState {
  active: boolean;
  /** Clave i18n del texto del modal. */
  labelKey: string;
}

const BUSY_IGNORED = [/\/(api_)?copilot_/];
const BUSY_LABEL = 'common.processing';
const BUSY_LABEL_LOGOUT = 'common.loggingOut';

const busyListeners = new Set<(state: BusyState) => void>();
let busyPending = 0;
let busyLabelKey = BUSY_LABEL;
/** Tras el logout la página navega: el modal no se cierra en ningún caso. */
let busyLocked = false;

export function getBusyState(): BusyState {
  return { active: busyLocked || busyPending > 0, labelKey: busyLabelKey };
}

export function subscribeBusy(listener: (state: BusyState) => void): () => void {
  busyListeners.add(listener);
  return () => {
    busyListeners.delete(listener);
  };
}

function notifyBusy(): void {
  const state = getBusyState();
  for (const l of busyListeners) l(state);
}

function busyBegin(labelKey: string): void {
  busyPending += 1;
  busyLabelKey = labelKey;
  notifyBusy();
}

function busyEnd(): void {
  busyPending = Math.max(0, busyPending - 1);
  if (busyPending === 0 && !busyLocked) busyLabelKey = BUSY_LABEL;
  notifyBusy();
}

/** Solo para pruebas. */
export function resetBusyForTests(): void {
  busyPending = 0;
  busyLocked = false;
  busyLabelKey = BUSY_LABEL;
  logoutInFlight = false;
  notifyBusy();
}

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
    const url = requestUrl(input);
    const optOut = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get('X-Busy') === 'off';
    const trackBusy = !SAFE_METHODS.has(method) && !optOut && !BUSY_IGNORED.some((re) => re.test(url));
    if (!SAFE_METHODS.has(method) && csrfToken) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrfToken);
      headers.delete('X-Busy');
      next = { ...init, headers };
    }
    if (trackBusy) busyBegin(url.includes(`${BFF_AUTH_PATH}/logout`) ? BUSY_LABEL_LOGOUT : BUSY_LABEL);
    let response: Response;
    try {
      response = await original(input, { credentials: 'same-origin', ...next });
    } finally {
      if (trackBusy) busyEnd();
    }

    if (response.status === 401 && !requestUrl(input).includes('/bff/auth/')) {
      redirectToBffLogin();
    }
    return response;
  };
}

/** Cierra la sesión en el BFF (revoca tokens y destruye la sesión) y vuelve al inicio. */
let logoutInFlight = false;

export async function bffLogout(): Promise<void> {
  // Un segundo clic mientras el primero sigue en curso no repite la petición.
  if (logoutInFlight) return;
  logoutInFlight = true;
  busyLocked = true;
  busyLabelKey = BUSY_LABEL_LOGOUT;
  notifyBusy();
  try {
    await fetch(`${BFF_AUTH_PATH}/logout`, { method: 'POST', credentials: 'same-origin' });
  } finally {
    window.location.assign('/');
  }
}

export interface BffUser {
  username?: string;
  name?: string;
  email?: string;
  partner_id?: number;
  is_admin?: boolean;
  is_tmwe?: boolean;
  /** `backend` cuando las capacidades las calculó el contexto del API (no la deducción conservadora del BFF). */
  capabilities_source?: string;
  /** `false` solo cuando el API denegó la entrada al ERP (ERP_ACCESS_DENIED, sin erp_operator). */
  erp_access?: boolean;
  /** Capacidades de facturación/almacén/cobros/COD que calcula el backend (solo booleanos). */
  invoicing?: {
    can_read?: boolean;
    can_write?: boolean;
    can_send?: boolean;
    can_export?: boolean;
    can_admin_numbering?: boolean;
  };
}

export interface BffSession {
  authenticated: boolean;
  csrf_token?: string;
  access_expires_at?: number;
  /** Quién es el usuario; lo calcula el BFF al autenticar. */
  user?: BffUser;
  /** Qué puede ver la SPA (`tmwe`, `clients`, `my_org`…); lo calcula el BFF al autenticar. */
  capabilities?: string[];
  /** Partner suplantado por el personal TMWE (`/bff/impersonation`), o null si no hay suplantación. */
  impersonation?: { id: number; rag_soc?: string } | null;
}

/**
 * Partner con el que trabaja la sesión: el suplantado si lo hay, si no el del usuario. Es el mismo que usa el
 * backend para filtrar (X-Effective-Partner-Id), así que «Mi organización» abre la ficha de ese partner. Antes
 * se usaba siempre el del usuario: suplantando, /my-org llevaba a la ficha de TMWE (anagrafica 1) y el API,
 * que ya filtraba por el partner suplantado, respondía 404.
 */
export function effectivePartnerId(session: Pick<BffSession, 'user' | 'impersonation'>): number {
  const impersonated = Number(session.impersonation?.id ?? 0);
  return impersonated > 1 ? impersonated : (session.user?.partner_id ?? 0);
}

/**
 * Bootstrap `__TMWE_INVOICING__` a partir de la sesión del BFF. Lo leen invoicing, payments, cod_assegni
 * y warehouse (`env.ts`) para decidir qué acciones de escritura ofrecer; el backend sigue autorizando.
 * Sin capacidades en la sesión devuelve `undefined` y esos módulos conservan su valor por defecto (solo lectura).
 * `audience` es siempre `operator`: ser partner no implica solo lectura, lo decide `can_write`.
 */
export function invoicingBootstrapFrom(
  user: BffUser | undefined,
  base: { basePath: string; language: string | null; csrf: string },
): Record<string, unknown> | undefined {
  const c = user?.invoicing;
  if (!c) return undefined;
  return {
    invoiceId: null,
    isNew: false,
    basePath: base.basePath,
    language: base.language,
    csrf: base.csrf,
    audience: 'operator',
    capabilities: {
      canRead: c.can_read === true,
      canWrite: c.can_write === true,
      canSend: c.can_send === true,
      canExport: c.can_export === true,
      canAdminNumbering: c.can_admin_numbering === true,
    },
  };
}

function safeLocale(): string | null {
  try {
    return localStorage.getItem('tmwe.locale');
  } catch {
    return null;
  }
}

/**
 * ¿La sesión carece, de forma fiable, de todo acceso al ERP? Solo si el BFF lo marcó (`erp_access === false`,
 * cuando el API respondió ERP_ACCESS_DENIED) y el usuario no es TMWE. Unas capacidades vacías NO significan
 * «sin acceso»: el API las da vacías a todo operador de partner que no administra su organización, y la reserva
 * del BFF o un fallo al cargar el contexto también las dejan vacías. Cada pantalla sigue autorizando en el API.
 */
export function sessionHasNoAccess(session: Pick<BffSession, 'user' | 'capabilities'>): boolean {
  return session.user?.is_tmwe !== true && session.user?.erp_access === false;
}

/** Lo contrario de {@link sessionHasNoAccess} sobre la sesión ya cargada por `bootstrapBff`. */
export function hasErpAccess(): boolean {
  const ops = (window as unknown as { __TMWE_OPERATIONS__?: { noAccess?: boolean } }).__TMWE_OPERATIONS__;
  return ops?.noAccess !== true;
}

/** Pinta la pantalla de «sin acceso» (cerrar sesión como única acción). */
export function showNoAccess(): void {
  renderNoAccess(safeLocale(), () => void bffLogout());
}

/**
 * Comprueba la sesión y deja el entorno listo para que arranque la SPA.
 * Devuelve false si se ha redirigido al login (no hay que montar la app).
 *
 * El usuario y las capacidades vienen en la propia respuesta de la sesión (el BFF las fija en
 * el login): la SPA no las deduce ni pide el perfil aparte.
 */
export async function bootstrapBff(): Promise<boolean> {
  installBffFetch();

  const res = await fetch(`${BFF_AUTH_PATH}/session`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  const session = (await res.json()) as BffSession;
  if (!session.authenticated || !session.csrf_token) {
    // Si el BFF nos devolvió con `?auth_error=`, no volvemos a mandar al login (bucle si el fallo
    // se repite): se muestra el motivo y el reintento es un clic del usuario.
    const authError = authErrorFromSearch(window.location.search);
    if (authError) {
      renderAuthError(authError, safeLocale(), bffLoginUrl('/'));
      return false;
    }
    redirectToBffLogin();
    return false;
  }
  setCsrfToken(session.csrf_token);

  const language = safeLocale();

  const w = window as unknown as Record<string, unknown>;
  w.__TMWE_NAV__ = { basePath: BFF_BASE_PATH };
  w.__TMWE_OPERATIONS__ = {
    basePath: BFF_BASE_PATH,
    language,
    csrf: session.csrf_token,
    isTmwe: session.user?.is_tmwe === true,
    partnerId: effectivePartnerId(session),
    capabilities: session.capabilities ?? [],
    noAccess: sessionHasNoAccess(session),
  };
  const invoicing = invoicingBootstrapFrom(session.user, { basePath: BFF_BASE_PATH, language, csrf: session.csrf_token });
  if (invoicing) w.__TMWE_INVOICING__ = invoicing;
  return true;
}
