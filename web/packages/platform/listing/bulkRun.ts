/**
 * Acciones por lote sobre un listado de trabajo: lógica pura (sin Vue ni red).
 *
 * SEGURIDAD — qué defiende cada capa:
 *  - La defensa real es el API: `Abstract_Shipment_Flag_Controller` exige que TODOS los ids pedidos
 *    pertenezcan a la anagrafica del token (`is_access_allowed` compara cuántos devuelve la consulta con
 *    cuántos se pidieron) y, si falta uno, rechaza el lote entero con 403. El SPA nunca decide permisos.
 *  - Aquí solo se reduce la superficie: los ids que se envían son SIEMPRE los de filas que el propio
 *    listado (ya filtrado por el API según el usuario) tiene cargadas. Nada que venga de la URL, del
 *    almacenamiento local ni de un campo libre puede acabar en un lote. Así, un id ajeno no se puede
 *    colar por un estado de selección obsoleto, y un lote enorme no se dispara por accidente.
 */

/** Tope por pasada (el mismo que el legado: `MAX_BULK`). */
export const BULK_MAX = 200;

export interface BulkSkipped {
  id: number;
  reason: string;
}

/** Forma común de la respuesta de `api_*_review` / `api_*_archive`. */
export interface BulkApiResult {
  success: boolean;
  error?: string;
  /** Solo viene si alguna se omitió; sin él, todas las pedidas se aplicaron. */
  applied?: number[];
  skipped?: BulkSkipped[];
}

export interface SanitizedBulk {
  ids: number[];
  /** Pedidas que no están entre las filas cargadas (selección obsoleta o manipulada): se descartan. */
  foreign: number;
  /** Había más del tope: se recorta y el llamador debe avisarlo. */
  overLimit: boolean;
}

/**
 * Reduce lo pedido a ids enteros positivos, sin repetir, que estén entre `loaded` (las filas que el
 * listado tiene cargadas), recortados a `max`.
 */
export function sanitizeBulkIds(
  requested: readonly unknown[],
  loaded: ReadonlySet<number>,
  max: number = BULK_MAX,
): SanitizedBulk {
  const seen = new Set<number>();
  let foreign = 0;
  for (const raw of requested) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      foreign++;
      continue;
    }
    if (!loaded.has(n)) {
      foreign++;
      continue;
    }
    seen.add(n);
  }
  const all = [...seen];
  return { ids: all.slice(0, max), foreign, overLimit: all.length > max };
}

export interface BulkSummary {
  /** Ids que el API aplicó. */
  applied: number[];
  skipped: BulkSkipped[];
}

/** Respuesta correcta del API → qué se aplicó y qué se omitió. */
export function summarizeBulk(
  requested: readonly number[],
  res: BulkApiResult,
): BulkSummary {
  const skipped = (res.skipped ?? []).filter(
    (s) => Number.isInteger(s?.id) && requested.includes(s.id),
  );
  const skippedIds = new Set(skipped.map((s) => s.id));
  // Solo se da por aplicado lo que el API confirma; si no manda `applied`, es todo lo no omitido.
  const confirmed = res.applied
    ? new Set(res.applied.filter((id) => requested.includes(id)))
    : null;
  const applied = requested.filter(
    (id) => !skippedIds.has(id) && (confirmed ? confirmed.has(id) : true),
  );
  return { applied, skipped };
}

export type BulkFailureKind = "denied" | "not_applicable" | "other";

export interface BulkFailure {
  kind: BulkFailureKind;
  message: string;
  skipped: BulkSkipped[];
}

/**
 * Error del lote → clasificación. `denied` (403) quiere decir que al menos un id no es del usuario: no se
 * reintenta con subconjuntos (sería sondear qué ids existen) y no se detalla cuál.
 */
export function classifyBulkError(err: unknown): BulkFailure {
  const e = err as {
    status?: number;
    errorCode?: string;
    message?: string;
    payload?: { error?: { details?: { skipped?: BulkSkipped[] } } };
  };
  const skipped = Array.isArray(e?.payload?.error?.details?.skipped)
    ? (e.payload!.error!.details!.skipped as BulkSkipped[])
    : [];
  if (e?.status === 403 || e?.errorCode === "ACCESS_DENIED") {
    return { kind: "denied", message: "", skipped: [] };
  }
  if (e?.status === 409 || e?.errorCode === "NOT_APPLICABLE") {
    return { kind: "not_applicable", message: e?.message ?? "", skipped };
  }
  return { kind: "other", message: e?.message ?? "", skipped };
}
