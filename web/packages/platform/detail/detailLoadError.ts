/**
 * Clasifica el fallo al abrir el detalle de una expedición (express o cargo)
 * a partir del `errorCode` del store.
 *
 * - `access_denied`: 403. El cliente http común colapsa todo 403 en
 *   `FORBIDDEN`; el backend puede mandar además ACCESS_DENIED o
 *   SHIPMENT_ACCESS_DENIED en el cuerpo de una respuesta 200 con
 *   success=false.
 * - `not_found`: no existe (o borrada).
 * - `generic`: cualquier otra cosa (red, 5xx…): es transitorio y se ofrece
 *   «Reintentar». Los dos anteriores son permanentes y no.
 */
export type DetailLoadErrorKind = 'access_denied' | 'not_found' | 'generic';

const ACCESS_CODES = new Set(['ACCESS_DENIED', 'SHIPMENT_ACCESS_DENIED', 'FORBIDDEN']);
const NOT_FOUND_CODES = new Set(['NOT_FOUND', 'SHIPMENT_NOT_FOUND', 'CARGO_NOT_FOUND']);

export function classifyDetailLoadError(code: string | null | undefined): DetailLoadErrorKind {
  const c = String(code ?? '').toUpperCase();
  if (ACCESS_CODES.has(c)) return 'access_denied';
  if (NOT_FOUND_CODES.has(c)) return 'not_found';
  return 'generic';
}

export function isPermanentDetailLoadError(kind: DetailLoadErrorKind): boolean {
  return kind !== 'generic';
}

/**
 * Código a partir de una excepción del cliente http (ApiError). Se mira por
 * forma y no con `instanceof`: el bundle puede acabar con dos copias de la
 * clase (app y chunk compartido) y `instanceof` daría false en silencio.
 */
export function errorCodeFromThrown(err: unknown): string | null {
  const e = err as { status?: number; errorCode?: string } | null;
  if (!e || typeof e.status !== 'number') return null;
  if (e.errorCode) return e.errorCode;
  if (e.status === 404) return 'NOT_FOUND';
  if (e.status === 403) return 'FORBIDDEN';
  return null;
}
