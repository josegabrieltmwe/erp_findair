/**
 * Lógica pura del módulo consolidata (sin Vue ni red): normalización de
 * errores del API y ayudas de presentación. No decide reglas de negocio —
 * las transiciones permitidas las dice el API (`meta`) y los servicios.
 */
import type {
  ConsolidataError,
  ConversionStep,
  LegPayload,
  ProjectPhase,
  ProjectState,
  ShipmentForm,
  Warning,
} from "./types";

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
  // Un código más concreto en details.code (p. ej. ACCESS_DENIED + manual_price_staff_only) manda si lo conocemos.
  const detailCode =
    typeof (details as { code?: unknown }).code === "string"
      ? String((details as { code?: unknown }).code)
      : "";
  const baseCode =
    typeof body.code === "string" ? body.code : e.code || "UNKNOWN";
  return {
    code: (KNOWN_ERROR_CODES as readonly string[]).includes(detailCode)
      ? detailCode
      : baseCode,
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
  "warning_not_waivable",
  "quote_not_answered",
  "quote_expired",
  "operation_in_progress",
  "manual_price_staff_only",
  "answer_price_mismatch",
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

/**
 * Validación de cliente de la house: el servidor ya rechaza los bultos <= 0 con 422, pero el
 * mensaje llega en bruto; aquí se evita la ida y vuelta. Devuelve claves i18n por campo.
 */
export function shipmentFormErrors(
  form: Pick<ShipmentForm, "colli">,
): Partial<Record<"colli", string>> {
  const errors: Partial<Record<"colli", string>> = {};
  const colli = Number(form.colli);
  if (form.colli === null || !Number.isInteger(colli) || colli <= 0) {
    errors.colli = "consolidata.shipments.colliInvalid";
  }
  return errors;
}

/**
 * Importe con formato local y el símbolo de su moneda. Sin moneda válida cae a
 * número con dos decimales + código, para no inventar un símbolo.
 */
export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
  locale = "es",
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return "—";
  const cur = (currency || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(cur)) {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: cur,
      }).format(Number(value));
    } catch {
      /* moneda desconocida para Intl: cae al formato numérico */
    }
  }
  const n = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
  return cur ? `${n} ${cur}` : n;
}

/** Número con formato local (pesos, cantidades). */
export function formatNumber(
  value: number | null | undefined,
  locale = "es",
  digits = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return "—";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

/** Color de chip por fase. */
export function phaseColor(
  fase: ProjectPhase | string | null | undefined,
): string {
  switch (fase) {
    case "abierto":
      return "info";
    case "sin_asignar":
    case "pendiente_respuesta":
      return "warning";
    case "respondido":
      return "primary";
    case "respuesta_vencida":
      return "error";
    case "por_convertir":
      return "deep-orange";
    case "convertido":
      return "success";
    case "cancelado":
      return "grey";
    default:
      return "default";
  }
}

export function phaseI18nKey(fase: string | null | undefined): string {
  const known = [
    "abierto",
    "sin_asignar",
    "pendiente_respuesta",
    "respondido",
    "respuesta_vencida",
    "por_convertir",
    "convertido",
    "cancelado",
  ];
  return fase && known.includes(fase)
    ? `consolidata.phase.${fase}`
    : "consolidata.phase.unknown";
}

export function conversionI18nKey(c: string | null | undefined): string {
  return c && ["no", "parcial", "completo"].includes(c)
    ? `consolidata.conversion.status.${c}`
    : "consolidata.conversion.status.no";
}

type ActionDefs = Record<string, { from: string[] | null }> | null | undefined;

/**
 * Puertas de los botones del detalle: cada botón por SU acción del catálogo del
 * API (`meta.actions[x].from`), sin reglas propias del front. `take` además
 * exige que el proyecto no esté ya asignado (el API respondería already_assigned), y `reopen` que
 * no esté convertido (already_converted).
 */
export function projectGates(
  actions: ActionDefs,
  stato: string,
  assignedTo: number | null | undefined,
  /** `conversione` del detalle: con conversión parcial o completa el API rechaza reopen (409 already_converted). */
  conversione?: string | null,
): Record<
  | "take"
  | "assign"
  | "answer"
  | "requestQuote"
  | "close"
  | "reopen"
  | "cancel"
  | "convert"
  | "operate"
  | "addShipment"
  | "updateShipment"
  | "removeShipment"
  | "addLeg"
  | "updateLeg"
  | "removeLeg"
  | "overridePrice"
  | "recalc"
  | "waive"
  | "note"
  | "setEori",
  boolean
> {
  const can = (a: string): boolean => actionAvailable(actions, a, stato);
  // `take` no tiene `from` en el catálogo, pero tomar un proyecto cerrado o cancelado no tiene sentido.
  const live = stato === "A" || stato === "P";
  return {
    take: can("take") && live && !assignedTo,
    assign: can("assign") && stato !== "X",
    answer: can("answer_quote"),
    requestQuote: can("request_quote"),
    close: can("close"),
    reopen: can("reopen") && (conversione ?? "no") === "no",
    cancel: can("cancel"),
    convert: can("convert"),
    operate: can("operate"),
    addShipment: can("add_shipment"),
    updateShipment: can("update_shipment"),
    removeShipment: can("remove_shipment"),
    addLeg: can("add_leg"),
    updateLeg: can("update_leg"),
    removeLeg: can("remove_leg"),
    overridePrice: can("override_price"),
    recalc: can("recalc"),
    waive: can("waive_warning"),
    note: can("note_internal"),
    setEori: can("set_eori"),
  };
}

/** Puerta de «Tomar» en el listado: misma regla que en el detalle, con el catálogo del API. */
export function canTakeRow(
  actions: ActionDefs,
  row: { stato: string; assegnato_a: number | null },
): boolean {
  return projectGates(actions, row.stato, row.assegnato_a).take;
}

/** Acciones del historial con texto propio (`consolidata.history.actions.<code>`). */
export const KNOWN_LOG_ACTIONS = [
  "create",
  "create_from_option",
  "add_leg",
  "update_leg",
  "remove_leg",
  "recalc",
  "request_quote",
  "close",
  "reopen",
  "cancel",
  "set_eori",
  "add_shipment",
  "update_shipment",
  "remove_shipment",
  "assign",
  "take",
  "note_internal",
  "answer_quote",
  "override_price",
  "convert",
  "operate",
  "waive_warning",
  "stato_auto",
  "house_detached",
] as const;

export function logActionI18nKey(code: string): string | null {
  return (KNOWN_LOG_ACTIONS as readonly string[]).includes(code)
    ? `consolidata.history.actions.${code}`
    : null;
}

/** Pasos globales del proyecto (MAWB / camión) frente a los de cada house. */
const GLOBAL_STEPS = ["cargo", "camion", "prenotare"];

export const STEP_ORDER = [
  "cargo",
  "spedizione",
  "prezzo",
  "collegare",
  "casa",
  "prenotare",
  "camion",
];

export interface StepGroup {
  key: string;
  global: boolean;
  steps: ConversionStep[];
}

/**
 * Agrupa los pasos de conversión: primero el grupo global (MAWB, reserva,
 * camión) y después uno por house (clave = ref), cada uno en el orden lógico.
 */
export function groupConversionSteps(passi: ConversionStep[]): StepGroup[] {
  const order = (p: string): number => {
    const i = STEP_ORDER.indexOf(p);
    return i === -1 ? STEP_ORDER.length : i;
  };
  const global: ConversionStep[] = [];
  const byHouse = new Map<string, ConversionStep[]>();
  for (const p of passi) {
    if (GLOBAL_STEPS.includes(String(p.passo))) {
      global.push(p);
      continue;
    }
    const k = String(p.chiave ?? "");
    if (!byHouse.has(k)) byHouse.set(k, []);
    byHouse.get(k)!.push(p);
  }
  const sort = (a: ConversionStep, b: ConversionStep): number =>
    order(String(a.passo)) - order(String(b.passo));
  const out: StepGroup[] = [];
  if (global.length)
    out.push({ key: "", global: true, steps: global.sort(sort) });
  for (const [key, steps] of byHouse)
    out.push({ key, global: false, steps: steps.sort(sort) });
  return out;
}

/** Color por estado del paso de conversión. */
export function stepColor(stato: string): string {
  const s = (stato || "").toUpperCase();
  if (s === "OK") return "success";
  if (s === "ERRORE" || s === "KO" || s === "ERROR") return "error";
  if (s === "SALTATO" || s === "SKIPPED") return "grey";
  return "warning";
}

/** Formulario del diálogo «Añadir tramo». */
export interface LegForm {
  tipo: LegPayload["tipo"];
  origin: { country: string; zip: string; city: string; terminal: string };
  destination: { country: string; zip: string; city: string; terminal: string };
  weight: number | null;
  value: number | null;
  goods: string;
  note: string;
  prezzo: number | null;
  fuel: number | null;
  supplementi: number | null;
}

/**
 * Formulario → payload de add_leg con las claves inglesas que valida el API
 * (validate_leg). Vacíos fuera; el precio manual solo si se pide.
 */
export function legPayload(f: LegForm, withManualPrice: boolean): LegPayload {
  const side = (s: LegForm["origin"]) => {
    const out: {
      country: string;
      zip: string;
      city: string;
      terminal?: string;
    } = {
      country: s.country.trim().toUpperCase(),
      zip: s.zip.trim(),
      city: s.city.trim(),
    };
    const trm = s.terminal.trim().toUpperCase();
    if (trm) out.terminal = trm;
    return out;
  };
  const leg: LegPayload = {
    tipo: f.tipo,
    origin: side(f.origin),
    destination: side(f.destination),
    weight: Number(f.weight),
  };
  if (f.value !== null && f.value !== undefined && String(f.value) !== "")
    leg.value = Number(f.value);
  if (f.goods.trim()) leg.goods = f.goods.trim();
  if (f.note.trim()) leg.note = f.note.trim();
  if (withManualPrice) {
    leg.price_source = "manuale";
    leg.manual_price = { prezzo: Number(f.prezzo ?? 0) };
    if (f.fuel) leg.manual_price.fuel = Number(f.fuel);
    if (f.supplementi) leg.manual_price.supplementi = Number(f.supplementi);
  }
  return leg;
}

/** Días transcurridos desde una fecha 'YYYY-MM-DD[ HH:MM:SS]' (antigüedad en el listado). */
export function ageDays(
  value: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!value) return null;
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}
