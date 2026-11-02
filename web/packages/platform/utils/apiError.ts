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
