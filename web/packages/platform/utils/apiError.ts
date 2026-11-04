/**
 * Lectura uniforme de los errores del API (`Api_Error::body`):
 *
 *   { success:false, error:{ code, message, details? }, error_code, message }
 *
 * Los servicios antiguos hacían `new Error(raw.error)` suponiendo que `error` es un texto; con la forma nueva
 * (objeto) acababan mostrando «[object Object]». Todo texto de error del API debe pasar por `errorText`.
 */

/** `error` del API: texto, o `{code, message, details}`. */
export type RawApiError =
  | string
  | { code?: string; message?: string; details?: unknown }
  | null
  | undefined;

/** Texto legible de un `error` del API (nunca «[object Object]»). */
export function errorText(error: RawApiError, fallback = 'Error'): string {
  if (error == null) return fallback;
  if (typeof error === 'string') return error || fallback;
  if (typeof error === 'object') {
    const msg = typeof error.message === 'string' ? error.message : '';
    const code = typeof error.code === 'string' ? error.code : '';
    return msg || code || fallback;
  }
  return fallback;
}

interface ErrorLike {
  message?: unknown;
  status?: unknown;
  code?: unknown;
  errorCode?: unknown;
  details?: unknown;
  data?: unknown;
  payload?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Cuerpo JSON del error del API tal como lo guardan los `ApiError` (`details`, `data` o `payload`). */
function bodyOf(e: unknown): Record<string, unknown> | null {
  if (!isRecord(e)) return null;
  const x = e as ErrorLike;
  for (const c of [x.details, x.payload, x.data]) {
    if (isRecord(c)) return c;
  }
  return null;
}

/**
 * Código de negocio del error (`ROLE_ROOT_ONLY`, `CARGO_HAS_AWB`...). Los clientes http sustituyen el código de
 * los 403/429/5xx por uno genérico (`FORBIDDEN`...), así que el real se lee del cuerpo.
 */
export function apiErrorCode(e: unknown): string | null {
  const body = bodyOf(e);
  if (body) {
    const err = body.error;
    if (isRecord(err) && typeof err.code === 'string' && err.code) return err.code;
    if (typeof body.error_code === 'string' && body.error_code) return body.error_code;
  }
  if (isRecord(e)) {
    const x = e as ErrorLike;
    if (typeof x.errorCode === 'string' && x.errorCode) return x.errorCode;
    if (typeof x.code === 'string' && x.code) return x.code;
  }
  return null;
}

/** `error.details` del cuerpo (objeto) o `{}`. */
export function apiErrorDetails(e: unknown): Record<string, unknown> {
  const body = bodyOf(e);
  const err = body?.error;
  if (isRecord(err) && isRecord(err.details)) return err.details;
  if (body && isRecord(body.details)) return body.details;
  return {};
}

/** Estado HTTP del error, o 0. */
export function apiErrorStatus(e: unknown): number {
  const s = isRecord(e) ? (e as ErrorLike).status : undefined;
  return typeof s === 'number' ? s : 0;
}

/**
 * Errores por campo de un 422 (`details.fields = { campo: mensaje }`, p. ej. los de `Field_Format_Validator`).
 * Devuelve `{}` si el error no trae campos.
 */
export function apiFieldErrors(e: unknown): Record<string, string> {
  const fields = apiErrorDetails(e).fields;
  const out: Record<string, string> = {};
  if (!isRecord(fields)) return out;
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

/** Texto de cualquier excepción capturada: mensaje del servidor, nunca un objeto. */
export function caughtText(e: unknown, fallback = 'Error'): string {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === 'string') return e || fallback;
  if (isRecord(e)) return errorText(e as { message?: string; code?: string }, fallback);
  return fallback;
}

/**
 * Texto de una excepción del API para el usuario: si el código de negocio tiene traducción en `errors.api.<CODE>`
 * se usa esa (en el idioma de la UI); si no, el mensaje que envía el servidor. `t`/`te` son los de `useI18n()`.
 */
export function localizedErrorText(
  e: unknown,
  i18n: { t: (key: string) => string; te: (key: string) => boolean },
  fallback = 'Error',
): string {
  const code = apiErrorCode(e);
  if (code) {
    const key = `errors.api.${code}`;
    if (i18n.te(key)) return i18n.t(key);
  }
  return caughtText(e, fallback);
}

/** Nombre del courier para el texto (`details.courier` llega en minúsculas: fedex, dhl, ups...). */
const COURIER_NAMES: Record<string, string> = { fedex: 'FedEx', dhl: 'DHL', ups: 'UPS', tnt: 'TNT', mytnt: 'TNT' };

/** Lo que la interfaz necesita para presentar un error: qué pasó, qué hacer y qué copiar para soporte. */
export interface UserError {
  /** Código de negocio (`COURIER_PACKAGE_OVERWEIGHT`...), o null. */
  code: string | null;
  /** `validation` | `courier_rejected` | `courier_unavailable` | `internal` | `unknown`. */
  category: string;
  /** Texto para el usuario, traducido si `errors.api.<CODE>` existe (con los datos de `details`). */
  message: string;
  /** Qué hacer, si hay consejo para el código (`errors.hint.<CODE>`) o la categoría (`errors.hint.category_<cat>`). */
  hint: string | null;
  details: Record<string, unknown>;
  requestId: string | null;
  /** Reintentar tiene sentido (el servicio no contestó). */
  retryable: boolean;
  status: number;
  /** Texto técnico para «Copiar detalle»: código, código del courier, mensaje original, request_id. */
  technical: string;
}

type Translator = {
  t: (key: string, named?: Record<string, unknown>) => string;
  te: (key: string) => boolean;
};

/**
 * Normaliza cualquier fallo (excepción del cliente http, o respuesta `success:false` devuelta con 200) a un
 * {@link UserError}. Es la única lectura que deben hacer los diálogos que muestran un error en línea.
 */
export function userError(e: unknown, i18n: Translator, fallback = 'Error'): UserError {
  const body = bodyOf(e) ?? (isRecord(e) && e.success === false ? e : null);
  // El cuerpo viene dentro de la excepcion (ApiError.payload) o es la propia respuesta success:false.
  const code = (body ? apiErrorCode({ details: body }) : null) ?? apiErrorCode(e);
  const details = body ? apiErrorDetails({ details: body }) : apiErrorDetails(e);
  const status = apiErrorStatus(e);

  const categoryRaw = details.category ?? body?.error_category;
  const category =
    typeof categoryRaw === 'string' && categoryRaw
      ? categoryRaw
      : status === 503
        ? 'courier_unavailable'
        : status >= 500
          ? 'internal'
          : status >= 400
            ? 'validation'
            : 'unknown';

  const courierKey = typeof details.courier === 'string' ? details.courier.toLowerCase() : '';
  const params: Record<string, unknown> = {
    ...details,
    courier: COURIER_NAMES[courierKey] ?? (courierKey ? courierKey.toUpperCase() : ''),
  };

  const serverText = body ? errorText(body.error as RawApiError, '') || (typeof body.message === 'string' ? body.message : '') : '';
  let message = serverText || caughtText(e, fallback);
  if (code && i18n.te(`errors.api.${code}`)) message = i18n.t(`errors.api.${code}`, params);

  let hint: string | null = null;
  if (code && i18n.te(`errors.hint.${code}`)) hint = i18n.t(`errors.hint.${code}`, params);
  else if (i18n.te(`errors.hint.category_${category}`)) hint = i18n.t(`errors.hint.category_${category}`, params);

  const rid = body?.request_id ?? (isRecord(body?.error) ? (body!.error as Record<string, unknown>).request_id : undefined) ?? details.request_id;
  const requestId = typeof rid === 'string' && rid ? rid : null;

  const technical = [
    code ? `code: ${code}` : '',
    status ? `http: ${status}` : '',
    typeof details.courier_code === 'string' ? `courier_code: ${details.courier_code}` : '',
    typeof details.field === 'string' ? `field: ${details.field}` : '',
    typeof details.courier_message === 'string' ? `courier: ${details.courier_message}` : serverText ? `message: ${serverText}` : '',
    requestId ? `request_id: ${requestId}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    code,
    category,
    message,
    hint,
    details,
    requestId,
    retryable: details.retryable === true || status === 503,
    status,
    technical,
  };
}
