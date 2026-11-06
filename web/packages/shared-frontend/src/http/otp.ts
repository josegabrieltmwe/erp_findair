/**
 * Arranque de las páginas a las que se llega con el OTP de un correo (una aerolínea que responde a una cotización).
 *
 * No hay usuario: el OTP no autentica a nadie, AUTORIZA el acceso a un recurso. Esta función es el primer paso de la página:
 * presenta el OTP al punto de autorización del BFF (`POST /bff/auth/otp`) y solo si lo autoriza hay sesión. El navegador no
 * ve ningún token: recibe una cookie opaca y el BFF negocia y guarda el Bearer de la aplicación.
 *
 * Después de abrir la sesión el OTP sale de la barra de direcciones (history.replaceState): vive en el servidor, cifrado.
 * Al recargar sin él se reanuda la sesión por la cookie.
 */

import { installBffFetch, setCsrfToken, setOtpMode, BFF_AUTH_PATH, BFF_BASE_PATH, type BffSession } from './bff';

/** Rutas de la SPA que se abren desde un correo, sin login. Declararlas aquí evita que el login del BFF las intercepte. */
export const OTP_LANDING_PATHS: readonly string[] = ['/offer'];

export type OtpFailure =
  /** Enlace no válido o caducado (el BFF no distingue las causas a propósito). */
  | 'invalid'
  /** Demasiados intentos fallidos: reintentar pasado `retryAfter`. */
  | 'locked'
  /** No se pudo comprobar ahora (el API o el servidor de tokens no contestan). */
  | 'unavailable'
  /** Este navegador tiene una sesión de usuario abierta (un operador probando el enlace). */
  | 'in_use'
  /** Se abrió sin OTP y no hay sesión que reanudar. */
  | 'expired';

export interface OtpResource {
  type: string;
  id: number;
  state?: string;
}

export type OtpBootstrap =
  | { ok: true; resource: OtpResource; scopes: string[]; csrf: string }
  | { ok: false; reason: OtpFailure; retryAfter?: number };

let bootstrapResult: OtpBootstrap | null = null;

/** Resultado del arranque, para que la vista sepa en qué estado empieza. */
export function getOtpBootstrap(): OtpBootstrap | null {
  return bootstrapResult;
}

export function isOtpLandingPath(pathname: string = window.location.pathname): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return OTP_LANDING_PATHS.includes(clean);
}

function setGlobals(csrf: string): void {
  let language: string | null = null;
  try {
    language = localStorage.getItem('tmwe.locale');
  } catch {
    language = null;
  }
  const w = window as unknown as Record<string, unknown>;
  w.__TMWE_NAV__ = { basePath: BFF_BASE_PATH };
  // Sin usuario: ni capacidades, ni suplantación, ni acceso de operador.
  w.__TMWE_OPERATIONS__ = {
    basePath: BFF_BASE_PATH,
    language,
    csrf,
    isTmwe: false,
    impersonating: false,
    partnerId: 0,
    capabilities: [],
    noAccess: false,
    otp: true,
  };
}

function stripQuery(): void {
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // Sin History API (entornos de prueba): el OTP simplemente sigue en la URL.
  }
}

function finish(result: OtpBootstrap): OtpBootstrap {
  bootstrapResult = result;
  return result;
}

/**
 * Autoriza la visita. Con `?id=…&otp=…` presenta el OTP; sin ellos intenta reanudar una sesión de OTP ya abierta (recarga).
 * Nunca redirige al login del BFF: aquí no hay a quién loguear.
 */
export async function bootstrapOtp(): Promise<OtpBootstrap> {
  setOtpMode(true);
  installBffFetch();

  const query = new URLSearchParams(window.location.search);
  const id = query.get('id');
  const otp = query.get('otp');
  // Tipo de recurso del enlace (`courier_offer`…). Sin él, la solicitud de una aerolínea (`cargo_offer`), que es lo que
  // llevan los enlaces ya enviados. Solo la forma: el BFF rechaza un tipo que no conozca.
  const rawType = query.get('type');
  const type = rawType && /^[a-z_]{1,32}$/.test(rawType) ? rawType : undefined;

  if (id && otp) {
    let response: Response;
    try {
      response = await fetch(`${BFF_AUTH_PATH}/otp`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(type ? { type, id, otp } : { id, otp }),
      });
    } catch {
      return finish({ ok: false, reason: 'unavailable' });
    }

    if (response.status === 200) {
      const session = (await response.json()) as BffSession & { resource?: OtpResource };
      if (session.authenticated && session.csrf_token && session.resource) {
        setCsrfToken(session.csrf_token);
        setGlobals(session.csrf_token);
        stripQuery();
        return finish({ ok: true, resource: session.resource as OtpResource, scopes: session.scopes ?? [], csrf: session.csrf_token });
      }
      return finish({ ok: false, reason: 'unavailable' });
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers?.get?.('Retry-After') ?? 0);
      return finish({ ok: false, reason: 'locked', retryAfter: retryAfter > 0 ? retryAfter : undefined });
    }
    if (response.status === 409) return finish({ ok: false, reason: 'in_use' });
    if (response.status >= 500) return finish({ ok: false, reason: 'unavailable' });
    // 403 (y cualquier otro rechazo): el enlace no sirve. El OTP malo no se queda en la barra.
    stripQuery();
    return finish({ ok: false, reason: 'invalid' });
  }

  // Sin OTP en la URL: ¿hay una sesión de OTP abierta (recarga de la página)?
  try {
    const res = await fetch(`${BFF_AUTH_PATH}/session`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const session = (await res.json()) as BffSession;
    if (session.authenticated && session.kind === 'otp' && session.csrf_token && session.resource) {
      setCsrfToken(session.csrf_token);
      setGlobals(session.csrf_token);
      return finish({ ok: true, resource: session.resource, scopes: session.scopes ?? [], csrf: session.csrf_token });
    }
    return finish({ ok: false, reason: 'expired' });
  } catch {
    return finish({ ok: false, reason: 'unavailable' });
  }
}
