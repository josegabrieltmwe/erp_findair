/**
 * Colas de trabajo de giacenze y estado del ciclo (lógica pura, sin Vue ni red).
 *
 * Es el equivalente de los «cestini» de Jose_master (`HOLDS` en giacenze.html) y de los contadores
 * de la home del legado: cada cola es un filtro que el servidor ya sabe aplicar (`indicator=` o
 * `data_close_flag`), así que el número de la cola y su lista coinciden con los de la home.
 *
 * Ciclo de una giacenza abierta (decisión de negocio: las fechas las fijan las acciones, no el operador):
 *   cliente avisado (cont_cliente_data) → instrucciones del cliente (risp_cliente_data)
 *   → proveedor instruido (cont_fornitore_data, posterior a la respuesta) → cerrar.
 */
import type { Giacenza, GiacenzaFilters } from "./types";

export type QueueId =
  | "to_notify"
  | "waiting_client"
  | "to_instruct_supplier"
  | "over_15"
  | "open"
  | "closed"
  | "all";

export const QUEUE_ORDER: readonly QueueId[] = [
  "to_notify",
  "waiting_client",
  "to_instruct_supplier",
  "over_15",
  "open",
  "closed",
  "all",
];

/** Cola con la que se abre la página sin parámetros (como Jose_master: lo primero que hay que hacer). */
export const DEFAULT_QUEUE: QueueId = "to_notify";

type QueueFilters = Pick<GiacenzaFilters, "indicator" | "closed">;

const QUEUE_FILTERS: Record<QueueId, QueueFilters> = {
  to_notify: { indicator: "giac_to_notify_client", closed: null },
  waiting_client: { indicator: "awaiting_client_response", closed: null },
  to_instruct_supplier: {
    indicator: "giac_to_instruct_supplier",
    closed: null,
  },
  over_15: { indicator: "giac_open_over_15_days", closed: null },
  open: { indicator: "open_giacenze", closed: null },
  closed: { indicator: null, closed: "S" },
  all: { indicator: null, closed: null },
};

/** Filtros de servidor de una cola. */
export function queueFilters(id: QueueId): QueueFilters {
  return { ...QUEUE_FILTERS[id] };
}

/** Cola que corresponde a un `?indicator=` de la URL (o de la home). `null` si no es de ninguna. */
export function queueFromIndicator(
  indicator: string | null | undefined,
): QueueId | null {
  switch (indicator) {
    case "giac_to_notify_client":
      return "to_notify";
    case "awaiting_client_response":
      return "waiting_client";
    case "giac_to_instruct_supplier":
      return "to_instruct_supplier";
    case "giac_open_over_15_days":
      return "over_15";
    case "open_giacenze":
      return "open";
    default:
      return null;
  }
}

/** Fecha informada: distinta de vacío y del centinela `0000-00-00` de la base. */
export function hasDate(value: string | null | undefined): boolean {
  return !!value && !value.startsWith("0000-00-00");
}

export type LifecycleStep =
  | "closed"
  | "notify_client"
  | "waiting_client"
  | "instruct_supplier"
  | "ready_to_close";

/** Siguiente paso del ciclo de una giacenza. */
export function lifecycleStep(g: Giacenza): LifecycleStep {
  if (hasDate(g.data_close)) return "closed";
  if (!hasDate(g.cont_cliente_data)) return "notify_client";
  if (!hasDate(g.risp_cliente_data)) return "waiting_client";
  const supplier = g.cont_fornitore_data ?? "";
  if (!hasDate(supplier) || supplier < (g.risp_cliente_data ?? ""))
    return "instruct_supplier";
  return "ready_to_close";
}

/** Días naturales desde la apertura (0 si no hay fecha). */
export function openDays(g: Giacenza, now: Date = new Date()): number {
  if (!hasDate(g.data_open)) return 0;
  const opened = new Date(`${(g.data_open as string).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(opened.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((now.getTime() - opened.getTime()) / 86_400_000),
  );
}

/** Una abierta hace más de 10 días se resalta en la lista (umbral de Jose_master). */
export const STALE_DAYS = 10;

export function isStale(g: Giacenza, now: Date = new Date()): boolean {
  return lifecycleStep(g) !== "closed" && openDays(g, now) > STALE_DAYS;
}
