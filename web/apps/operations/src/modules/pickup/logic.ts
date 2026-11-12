/**
 * Lógica pura del módulo de ritiri y autistas (sin Vue ni red): colas de trabajo,
 * rangos del calendario, resultado de operaciones masivas, cambios pendientes de
 * zonas y formato del borderò. Se prueba en `logic.spec.ts`.
 */
import { todayLocal } from "@shared/utils/date";
import type { ListingWorkView } from "@shared/listing/types";
import type {
  BulkResult,
  BulkResultItem,
  CalendarDay,
  DriverZone,
  ManifestShipment,
  ManifestSummary,
  Pickup,
  PickupFilters,
  RouteStop,
  ZoneSaveItem,
} from "./types";

// ---------------------------------------------------------------- fechas

/** Convierte `YYYY-MM-DD` (o con hora) en fecha local a las 00:00. */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Suma días a una fecha `YYYY-MM-DD` (puede ser negativo) sin pasar por UTC. */
export function addDays(iso: string, days: number): string {
  const d = parseDay(iso);
  d.setDate(d.getDate() + days);
  return todayLocal(d);
}

/** Suma meses al primer día del mes de la fecha. */
export function addMonths(iso: string, months: number): string {
  const d = parseDay(iso);
  return todayLocal(new Date(d.getFullYear(), d.getMonth() + months, 1));
}

/** Lunes de la semana de la fecha (semana ISO: lunes a domingo). */
export function startOfWeek(iso: string): string {
  const d = parseDay(iso);
  const offset = (d.getDay() + 6) % 7; // lunes = 0
  return addDays(iso, -offset);
}

// ---------------------------------------------------------------- colas de trabajo

/** Identificadores de las colas de trabajo de la lista de ritiri. */
export type PickupQueueId =
  | "all"
  | "to_assign"
  | "assigned_today"
  | "assigned_30"
  | "unassigned_soon"
  | "overdue";

/** Días hacia atrás que abarca la cola «Vencidas» y hacia delante «Affidate 30 días». */
export const QUEUE_WINDOW_DAYS = 30;

const ALL_COLUMNS = [
  "id",
  "data",
  "id_sede",
  "id_contatti",
  "address_sped",
  "n_colli",
  "peso",
  "presa_fissa",
  "affidata",
  "actions",
] as const;

/** Vistas de trabajo para `ListingWorkViewSelector` (las etiquetas son claves i18n). */
export const PICKUP_QUEUES: readonly ListingWorkView[] = [
  { id: "all", labelKey: "pickup.queue.all", columns: ALL_COLUMNS },
  { id: "to_assign", labelKey: "pickup.queue.to_assign", columns: ALL_COLUMNS },
  {
    id: "assigned_today",
    labelKey: "pickup.queue.assigned_today",
    columns: ALL_COLUMNS,
  },
  {
    id: "assigned_30",
    labelKey: "pickup.queue.assigned_30",
    columns: ALL_COLUMNS,
  },
  {
    id: "unassigned_soon",
    labelKey: "pickup.queue.unassigned_soon",
    columns: ALL_COLUMNS,
  },
  { id: "overdue", labelKey: "pickup.queue.overdue", columns: ALL_COLUMNS },
];

/** Cola → filtros del servidor. `all` no impone nada (filtros manuales). */
export function queueFilters(
  queue: PickupQueueId,
  today: string,
): PickupFilters {
  switch (queue) {
    case "to_assign":
      return { affidata: "N", data_da: today };
    case "assigned_today":
      return { affidata: "S", data: today };
    case "assigned_30":
      return {
        affidata: "S",
        data_da: today,
        data_a: addDays(today, QUEUE_WINDOW_DAYS),
      };
    case "unassigned_soon":
      return { affidata: "N", data_da: today, data_a: addDays(today, 1) };
    case "overdue":
      return {
        data_da: addDays(today, -QUEUE_WINDOW_DAYS),
        data_a: addDays(today, -1),
      };
    default:
      return {};
  }
}

/** Una fecha sin valor: nula, vacía o la fecha cero del legado. */
export function isEmptyDate(value: string | null | undefined): boolean {
  return !value || value.startsWith("0000-00-00");
}

/**
 * El API no filtra por «ritiro hecho», así que la cola «Vencidas» descarta en
 * pantalla las presas con `data_ritiro` informada.
 */
export function isOverdueOpen(p: Pick<Pickup, "data_ritiro">): boolean {
  return isEmptyDate(p.data_ritiro);
}

/**
 * Incoherencia entre `affidata` e `id_contatti` (criterio de aceptación del plan):
 * «affidata sin autista» o autista asignado con `affidata = N`.
 */
export function isIncoherent(
  p: Pick<Pickup, "affidata" | "id_contatti">,
): boolean {
  const hasDriver = Number(p.id_contatti) > 0;
  return (p.affidata === "S") !== hasDriver;
}

// ---------------------------------------------------------------- operaciones masivas

/** Máximo de presas por petición masiva (tope del API). */
export const BULK_LIMIT = 200;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

/** Une los resultados de varias peticiones masivas en uno. */
export function mergeBulkResults(parts: readonly BulkResult[]): BulkResult {
  const results: BulkResultItem[] = parts.flatMap((p) => p.results ?? []);
  return {
    assigned: parts.reduce((n, p) => n + (p.assigned ?? 0), 0),
    failed: parts.reduce((n, p) => n + (p.failed ?? 0), 0),
    results,
  };
}

/** Presas que fallaron, con su motivo. */
export function failedItems(result: BulkResult): BulkResultItem[] {
  return (result.results ?? []).filter((r) => !r.ok);
}

// ---------------------------------------------------------------- calendario

export type CalendarView = "day" | "week" | "month";

export interface DateRange {
  from: string;
  to: string;
}

/** Rango (inclusivo) que hay que pedir al API para la vista y la fecha de referencia. */
export function calendarRange(view: CalendarView, date: string): DateRange {
  if (view === "day") return { from: date, to: date };
  if (view === "week") {
    const from = startOfWeek(date);
    return { from, to: addDays(from, 6) };
  }
  const first = `${date.slice(0, 7)}-01`;
  const from = startOfWeek(first);
  const lastOfMonth = addDays(addMonths(first, 1), -1);
  const to = addDays(startOfWeek(lastOfMonth), 6);
  return { from, to };
}

/** ¿El rango ya cargado cubre el pedido? Permite cambiar de vista sin volver a pedir. */
export function rangeCovers(
  loaded: DateRange | null,
  wanted: DateRange,
): boolean {
  return !!loaded && loaded.from <= wanted.from && loaded.to >= wanted.to;
}

/** Fecha de referencia tras avanzar o retroceder una unidad de la vista. */
export function shiftReference(
  view: CalendarView,
  date: string,
  delta: number,
): string {
  if (view === "day") return addDays(date, delta);
  if (view === "week") return addDays(date, delta * 7);
  return addMonths(date, delta);
}

export interface PeriodCell {
  date: string;
  /** Día del mes que se está mostrando (false = relleno de semanas vecinas). */
  inPeriod: boolean;
  isToday: boolean;
  pickups: Pickup[];
  count: number;
  assigned: number;
  notAssigned: number;
}

/**
 * Celdas de la vista semana/mes: una por día del rango, con las presas del día
 * (días sin presas = celda vacía). Los contadores se recalculan sobre las presas
 * recibidas si el API no manda el día.
 */
export function buildPeriodCells(
  view: Exclude<CalendarView, "day">,
  date: string,
  days: readonly CalendarDay[],
  today: string = todayLocal(),
): PeriodCell[] {
  const range = calendarRange(view, date);
  const byDate = new Map<string, CalendarDay>();
  for (const d of days) byDate.set(d.date.slice(0, 10), d);
  const month = date.slice(0, 7);
  const cells: PeriodCell[] = [];
  for (let cur = range.from; cur <= range.to; cur = addDays(cur, 1)) {
    const day = byDate.get(cur);
    const pickups = day?.pickups ?? [];
    const assigned = pickups.filter((p) => p.affidata === "S").length;
    cells.push({
      date: cur,
      inPeriod: view === "week" || cur.startsWith(month),
      isToday: cur === today,
      pickups,
      count: day?.count ?? pickups.length,
      assigned: day?.assigned ?? assigned,
      notAssigned: day?.not_assigned ?? pickups.length - assigned,
    });
  }
  return cells;
}

/** Filtra las presas por autista (0 = sin asignar); `null` = todas. */
export function filterByDriver<T extends Pick<Pickup, "id_contatti">>(
  pickups: readonly T[],
  driverId: number | null,
): T[] {
  if (driverId === null) return [...pickups];
  return pickups.filter((p) => (p.id_contatti || 0) === driverId);
}

export type PickupColorKind =
  | "triangulation"
  | "with_shipment"
  | "fixed"
  | "normal";

/** Color de leyenda del calendario: triangulación, con expedición, fija sin expedición u otra. */
export function pickupColorKind(
  p: Pick<Pickup, "address_sped" | "presa_fissa" | "shipment_ids">,
): PickupColorKind {
  if (p.address_sped === "S") return "triangulation";
  if ((p.shipment_ids?.length ?? 0) > 0) return "with_shipment";
  if (p.presa_fissa === "S") return "fixed";
  return "normal";
}

// ---------------------------------------------------------------- zonas CAP → autista

/** Un CAP italiano son cinco cifras. */
export function isValidCap(cap: string): boolean {
  return /^\d{5}$/.test(cap.trim());
}

export interface ZoneChange {
  cap: string;
  /** 0 = quitar la asignación. */
  id_contatto: number;
}

/**
 * Cambios pendientes de zonas. `edits` mapea CAP → nuevo contacto (0 = quitar).
 * Se omiten las ediciones que dejan el valor original y los CAP nuevos sin autista.
 */
export function zoneChanges(
  zones: readonly DriverZone[],
  edits: Readonly<Record<string, number>>,
): ZoneChange[] {
  const current = new Map(
    zones.map((z) => [z.cap, Number(z.id_contatto) || 0]),
  );
  const out: ZoneChange[] = [];
  for (const [cap, value] of Object.entries(edits)) {
    const next = Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
    const before = current.get(cap);
    if (before === undefined && next === 0) continue;
    if (before !== undefined && before === next) continue;
    out.push({ cap, id_contatto: next });
  }
  return out;
}

export function zoneFailures(items: readonly ZoneSaveItem[]): ZoneSaveItem[] {
  return items.filter((i) => !i.ok);
}

// ---------------------------------------------------------------- borderò

/** Tipo de parada: sin `kind` (API anterior) se toma como ritiro. */
export function stopKind(stop: Pick<RouteStop, "kind">): "R" | "C" {
  return stop.kind === "C" ? "C" : "R";
}

export interface StopAddressView {
  name: string;
  line: string;
  /** Texto para buscar en un mapa. */
  query: string;
}

function joinParts(
  parts: ReadonlyArray<string | null | undefined>,
  sep: string,
): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p !== "")
    .join(sep);
}

/** Dirección de la parada: la real (`direccion`) si viene; si no, la de la sede. */
export function stopAddress(stop: RouteStop): StopAddressView {
  const d = stop.direccion;
  const a = d ?? stop.sede;
  const place = joinParts([a.cap, a.citta], " ");
  const prov = (a.prov ?? "").trim();
  const line = joinParts(
    [a.indirizzo, prov ? `${place} (${prov})` : place],
    ", ",
  );
  const name = d?.nombre?.trim() || stop.cliente?.ragsoc || "";
  return { name, line, query: joinParts([a.indirizzo, place, a.prov], ", ") };
}

/** Hora `HH:MM` de la cita de la parada. */
export function stopTime(stop: Pick<RouteStop, "pickup_datetime">): string {
  return (stop.pickup_datetime.split(" ")[1] ?? "").slice(0, 5);
}

/** Enlace de búsqueda de Google Maps por dirección. Vacío si no hay dirección. */
export function mapsSearchUrl(query: string): string {
  const q = query.trim();
  return q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : "";
}

/** Enlace de Google Maps por coordenadas. Vacío si faltan o no son válidas. */
export function mapsCoordsUrl(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  if (lat == null || lng == null) return "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  if (lat === 0 && lng === 0) return "";
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Enlaces de mapa de una parada. Las coordenadas son las de la sede, así que
 * solo se ofrecen cuando se para en la sede (no en la dirección de la expedición).
 */
export function stopMapLinks(stop: RouteStop): {
  address: string;
  coords: string;
} {
  const atSede = stop.direccion ? stop.direccion.origen !== "expedicion" : true;
  return {
    address: mapsSearchUrl(stopAddress(stop).query),
    coords: atSede ? mapsCoordsUrl(stop.sede?.lat, stop.sede?.lng) : "",
  };
}

/** Importe con dos decimales (la moneda la pone la plantilla). */
export function formatAmount(value: number, locale = "es"): string {
  return Number(value).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface ManifestRow {
  key: string;
  order: number;
  kind: "R" | "C";
  name: string;
  address: string;
  /** Código de barras en texto (vacío si la parada no trae expediciones). */
  ldv: string;
  ref: string;
  colli: number;
  peso: number;
  /** Importe a cobrar; 0 = nada que cobrar. */
  cod: number;
  time: string;
}

/**
 * Filas imprimibles del borderò: una por expedición de cada parada; una parada
 * sin expediciones (p. ej. un ritiro de la sede) ocupa una fila con los bultos
 * y el peso de la presa.
 */
export function manifestRows(stops: readonly RouteStop[]): ManifestRow[] {
  const rows: ManifestRow[] = [];
  for (const stop of stops) {
    const addr = stopAddress(stop);
    const base = {
      order: stop.order,
      kind: stopKind(stop),
      name: addr.name,
      address: addr.line,
      time: stopTime(stop),
    };
    const shipments: readonly ManifestShipment[] = stop.shipments ?? [];
    if (shipments.length === 0) {
      rows.push({
        ...base,
        key: `p${stop.pickup_id}`,
        ldv: "",
        ref: "",
        colli: Number(stop.n_colli) || 0,
        peso: Number(stop.peso) || 0,
        cod: 0,
      });
      continue;
    }
    for (const s of shipments) {
      rows.push({
        ...base,
        key: `p${stop.pickup_id}-s${s.id}`,
        ldv: s.ldv || String(s.id),
        ref: s.ref_cliente ?? "",
        colli: Number(s.colli) || 0,
        peso: Number(s.peso) || 0,
        cod: Number(s.contrassegno) || 0,
      });
    }
  }
  return rows;
}

/** Totales del borderò: los del API si vienen, y si no (API anterior) los de las paradas. */
export function manifestTotals(
  summary: ManifestSummary,
  stops: readonly RouteStop[],
): Required<ManifestSummary> {
  const rows = manifestRows(stops);
  const pickups = stops.filter((s) => stopKind(s) === "R").length;
  return {
    total_stops: summary.total_stops ?? stops.length,
    total_colli: summary.total_colli ?? 0,
    total_peso: summary.total_peso ?? 0,
    total_pickups: summary.total_pickups ?? pickups,
    total_deliveries: summary.total_deliveries ?? stops.length - pickups,
    total_contrassegno:
      summary.total_contrassegno ?? rows.reduce((n, r) => n + r.cod, 0),
    shipments_colli:
      summary.shipments_colli ?? rows.reduce((n, r) => n + r.colli, 0),
    shipments_peso:
      summary.shipments_peso ?? rows.reduce((n, r) => n + r.peso, 0),
  };
}
