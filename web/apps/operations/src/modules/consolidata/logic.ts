/**
 * Lógica pura del módulo consolidata (sin Vue ni red): normalización de
 * errores del API y ayudas de presentación. No decide reglas de negocio —
 * las transiciones permitidas las dice el API (`meta`) y los servicios.
 */
import type { ConsolidataError, ProjectState, Warning } from "./types";

const EMPTY_ERROR: ConsolidataError = {
  code: "UNKNOWN",
  message: "",
  status: 0,
  fields: {},
  avisos: [],
  allowedStates: [],
};

/**
 * Convierte lo que lanza el http client compartido (ApiError con el cuerpo en
 * `details`) o un cuerpo `{success:false,...}` en un error normalizado.
 */
export function normalizeApiError(err: unknown): ConsolidataError {
  if (!err || typeof err !== "object") {
    return { ...EMPTY_ERROR };
  }
  const e = err as {
    message?: string;
    status?: number;
    code?: string;
    details?: unknown;
  };
  const body = (
    e.details && typeof e.details === "object" ? e.details : err
  ) as {
    error?: unknown;
    code?: unknown;
    details?: unknown;
    message?: unknown;
  };
  const details = (
    body.details && typeof body.details === "object" ? body.details : {}
  ) as {
    fields?: Record<string, string>;
    avisos?: Warning[];
    ammessi?: string[];
  } & Record<string, unknown>;

  const fields: Record<string, string> = {};
  if (details.fields && typeof details.fields === "object") {
    for (const [k, v] of Object.entries(details.fields)) {
      fields[k] = String(v);
    }
  }
  return {
    code: typeof body.code === "string" ? body.code : e.code || "UNKNOWN",
    message: typeof body.error === "string" ? body.error : e.message || "",
    status: typeof e.status === "number" ? e.status : 0,
    fields,
    avisos: Array.isArray(details.avisos) ? details.avisos : [],
    allowedStates: Array.isArray(details.ammessi)
      ? details.ammessi.map(String)
      : [],
  };
}

/** Códigos de error con texto propio en los locales (`consolidata.errors.<code>`). */
export const KNOWN_ERROR_CODES = [
  "VALIDATION_ERROR",
  "ACCESS_DENIED",
  "NOT_FOUND",
  "invalid_state",
  "project_not_editable",
  "already_assigned",
  "already_converted",
  "conversion_blocked",
  "METHOD_NOT_ALLOWED",
  "INTERNAL_ERROR",
] as const;

export function errorI18nKey(code: string): string {
  return (KNOWN_ERROR_CODES as readonly string[]).includes(code)
    ? `consolidata.errors.${code}`
    : "consolidata.errors.UNKNOWN";
}

/** Color de chip por estado del proyecto. */
export function stateColor(stato: ProjectState | string): string {
  switch (stato) {
    case "A":
      return "info";
    case "P":
      return "warning";
    case "C":
      return "success";
    case "X":
      return "grey";
    default:
      return "default";
  }
}

export function stateI18nKey(stato: string): string {
  return ["A", "P", "C", "X"].includes(stato)
    ? `consolidata.state.${stato}`
    : "consolidata.state.unknown";
}

/** ¿La acción está en los metadatos y admite el estado actual? Decide el API, no el front. */
export function actionAvailable(
  actions: Record<string, { from: string[] | null }> | null | undefined,
  action: string,
  stato: string,
): boolean {
  if (!actions) return false;
  const def = actions[action];
  if (!def) return false;
  return def.from === null || def.from.includes(stato);
}

/** Avisos que impiden convertir (los de severidad error o tarifa vencida, sin ignorar). */
export function blockingWarnings(avisos: Warning[]): Warning[] {
  return avisos.filter(
    (a) =>
      !a.ignorato && (a.severita === "error" || a.codice === "QUOTE_EXPIRED"),
  );
}

/** Fecha 'YYYY-MM-DD' o 'YYYY-MM-DD HH:MM:SS' → texto corto local; null → vacío. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.length >= 16 ? value.slice(0, 16) : value;
}
