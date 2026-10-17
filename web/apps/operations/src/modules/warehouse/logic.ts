/** Lógica pura del módulo warehouse (sin red ni Vue), cubierta por specs. */
import type {
  CompletenessItem,
  LoadedParcel,
  Outcome,
  OutcomeGroup,
  PendingClient,
  PendingShipment,
  TrackingStatusLite,
} from "./types";

export const DELIVERED_STATUS_ID = 7;
export const SCAN_DEBOUNCE_MS = 500;

/** Limpia lo que escribe el lector: trim; vacío => "". */
export function normalizeScan(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[\r\n\t]+/g, "").trim();
}

/**
 * Guardia contra lecturas dobles: un mismo código repetido dentro de la
 * ventana se ignora; vacíos también.
 */
export function createScanGuard(
  windowMs = SCAN_DEBOUNCE_MS,
  now: () => number = () => Date.now(),
): { accept(raw: string): string | null } {
  let last = "";
  let lastAt = -Infinity;
  return {
    accept(raw: string): string | null {
      const code = normalizeScan(raw);
      if (!code) return null;
      const t = now();
      if (code === last && t - lastAt < windowMs) return null;
      last = code;
      lastAt = t;
      return code;
    },
  };
}

/** Número positivo desde un texto (admite coma decimal) o null. */
export function parsePositive(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type WeighMode = "parcel" | "document";
export type WeighField = "kg" | "width" | "length" | "height";

export interface WeighInput {
  mode: WeighMode;
  kg: string;
  width: string;
  length: string;
  height: string;
}

export interface WeighValues {
  peso: number;
  dim_a?: number;
  dim_l?: number;
  dim_p?: number;
}

/** Valida el pesaje: paquete exige kg y 3 medidas > 0; documento solo kg. */
export function validateWeighing(input: WeighInput): {
  ok: boolean;
  errors: WeighField[];
  values?: WeighValues;
} {
  const errors: WeighField[] = [];
  const kg = parsePositive(input.kg);
  if (kg === null) errors.push("kg");
  let dims: Pick<WeighValues, "dim_a" | "dim_l" | "dim_p"> = {};
  if (input.mode === "parcel") {
    const w = parsePositive(input.width);
    const l = parsePositive(input.length);
    const h = parsePositive(input.height);
    if (w === null) errors.push("width");
    if (l === null) errors.push("length");
    if (h === null) errors.push("height");
    if (w !== null && l !== null && h !== null) {
      dims = { dim_a: w, dim_l: l, dim_p: h };
    }
  }
  if (errors.length || kg === null) return { ok: false, errors };
  return { ok: true, errors, values: { peso: kg, ...dims } };
}

/** Bultos sin pesar a partir del detalle de completitud. */
export function unweighedCount(c: {
  colli_total?: number;
  colli_weighed?: number;
}): number {
  return Math.max(0, (c.colli_total ?? 0) - (c.colli_weighed ?? 0));
}

/** El botón imprimir se habilita si todo está pesado o si es emergencia. */
export function canPrintWaybill(unweighed: number, emergency: boolean): boolean {
  return unweighed <= 0 || emergency;
}

export type MultiparcelView = "weighed" | "unweighed";

/** Multibulto = más de un bulto esperado; pesado = todos los registrados pesados. */
export function filterMultiparcel(
  items: CompletenessItem[],
  view: MultiparcelView,
): CompletenessItem[] {
  return items.filter((it) => {
    const c = it.completeness;
    const multi = Math.max(c.expected, c.colli_total) > 1;
    if (!multi) return false;
    const allWeighed = c.colli_total > 0 && c.colli_weighed >= c.colli_total;
    return view === "weighed" ? allWeighed : !allWeighed;
  });
}

/** Contadores en vivo del giro del autista. */
export function driverCounters(parcels: LoadedParcel[]): {
  parcels: number;
  shipments: number;
  printed: number;
  totalKg: number;
} {
  const ships = new Set<number>();
  let printed = 0;
  let totalKg = 0;
  for (const p of parcels) {
    ships.add(p.id_spedizione);
    if (p.ldv_stampata === "S") printed += 1;
    const kg = Number(p.peso);
    if (Number.isFinite(kg)) totalKg += kg;
  }
  return {
    parcels: parcels.length,
    shipments: ships.size,
    printed,
    totalKg: Math.round(totalKg * 100) / 100,
  };
}

/** ¿Ya está cargado este bulto en el giro? */
export function alreadyLoaded(parcels: LoadedParcel[], parcelId: number): boolean {
  return parcels.some((p) => p.id === parcelId);
}

/**
 * Resultados posibles de una entrega. Solo se ofrecen los de tipo 'D'
 * (entregado; el id 7 primero) y las excepciones de tipo 'P' (problema) y 'R'
 * (devolución al remitente), ordenadas por descripción. Los estados de
 * tránsito ('T'), en reparto ('C') y otros ('0') se ocultan. `opensHold`
 * marca las excepciones que abren una retención de stock (apri_giac 'S').
 */
export function mapOutcomes(
  statuses: TrackingStatusLite[],
  locale: string,
): Outcome[] {
  const pick = (s: TrackingStatusLite): string => {
    const l = locale.slice(0, 2);
    const byLocale =
      l === "it" ? s.descr_ita : l === "es" ? s.descr_spa : s.descr_eng;
    return (byLocale || s.descr_eng || s.descr_ita || `#${s.id}`).trim();
  };
  const list: Outcome[] = [];
  for (const s of statuses) {
    if (s.stato === "O") continue;
    const tipo = s.tipo ?? "";
    const group: OutcomeGroup | null =
      tipo === "D" ? "delivered" : tipo === "P" || tipo === "R" ? "exception" : null;
    if (!group) continue;
    list.push({
      id: String(s.id),
      label: pick(s),
      delivered: group === "delivered",
      group,
      opensHold: group === "exception" && s.apri_giac === "S",
    });
  }
  const rank = (o: Outcome): number =>
    o.delivered ? (o.id === String(DELIVERED_STATUS_ID) ? 0 : 1) : 2;
  return list.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}

export interface OutcomeSelectItem {
  type?: "subheader";
  title: string;
  value?: string;
}

/**
 * Items del v-select con cabeceras de grupo. Los grupos vacíos no aparecen.
 * `holdNote` se añade al título de las excepciones que abren retención.
 */
export function groupOutcomes(
  outcomes: Outcome[],
  labels: { delivered: string; exceptions: string; holdNote: string },
): OutcomeSelectItem[] {
  const items: OutcomeSelectItem[] = [];
  const del = outcomes.filter((o) => o.group === "delivered");
  const exc = outcomes.filter((o) => o.group === "exception");
  if (del.length) {
    items.push({ type: "subheader", title: labels.delivered });
    for (const o of del) items.push({ title: o.label, value: o.id });
  }
  if (exc.length) {
    items.push({ type: "subheader", title: labels.exceptions });
    for (const o of exc)
      items.push({
        title: o.opensHold ? `${o.label} (${labels.holdNote})` : o.label,
        value: o.id,
      });
  }
  return items;
}

/** 'YYYY-MM-DD' + 'HH:MM' => 'YYYY-MM-DD HH:MM:SS'. */
export function formatDeliveryDate(date: string, time: string): string {
  const t = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time || "00:00:00";
  return `${date} ${t}`;
}

export function todayIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Ids pegados (coma, espacio, salto de línea) => enteros únicos positivos. */
export function parseIdList(text: string): number[] {
  const out: number[] = [];
  for (const tok of text.split(/[\s,;]+/)) {
    if (!/^\d+$/.test(tok)) continue;
    const n = Number(tok);
    if (n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

/** invio_ftp nulo o fecha cero => no enviado. */
export function isManifestSent(invio: string | null | undefined): boolean {
  return !!invio && !/^0000-00-00/.test(invio);
}

/** Convierte base64 en Blob para abrir la etiqueta. */
export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// --- Pendientes por cliente (PackMaster) ---
export const PENDING_DAYS_OPTIONS = [3, 7, 14, 30, 60] as const;
export const PENDING_DAYS_DEFAULT = 7;

/** Más sin pesar primero; empate: más sin imprimir, luego nombre. */
export function sortPendingClients(items: PendingClient[]): PendingClient[] {
  return [...items].sort(
    (a, b) =>
      b.unweighed - a.unweighed ||
      b.unprinted - a.unprinted ||
      a.rag_soc.localeCompare(b.rag_soc),
  );
}

/** Filtro por nombre de cliente (sin mayúsculas/acentos); vacío => todos. */
export function filterPendingClients(
  items: PendingClient[],
  q: string,
): PendingClient[] {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const n = norm(q ?? "");
  if (!n) return items;
  return items.filter((c) => norm(c.rag_soc ?? "").includes(n));
}

export interface PendingSummary {
  customers: number;
  shipments: number;
  unweighed: number;
}

export function summarizePending(items: PendingClient[]): PendingSummary {
  return items.reduce<PendingSummary>(
    (a, c) => ({
      customers: a.customers + 1,
      shipments: a.shipments + (Number(c.shipments) || 0),
      unweighed: a.unweighed + (Number(c.unweighed) || 0),
    }),
    { customers: 0, shipments: 0, unweighed: 0 },
  );
}

/** Ámbar: bultos registrados menos que los declarados. */
export function pendingNotComplete(s: PendingShipment): boolean {
  return !s.complete || s.parcels < s.declared_parcels;
}

/** Ámbar: hay bultos sin pesar. */
export function pendingNotWeighed(s: PendingShipment): boolean {
  return !s.all_weighed || s.weighed < s.parcels;
}

export function pendingShipmentUnweighed(s: PendingShipment): number {
  return Math.max(0, s.parcels - s.weighed);
}

/** Limita los días al rango 1-60 del backend. */
export function clampPendingDays(n: number): number {
  if (!Number.isFinite(n)) return PENDING_DAYS_DEFAULT;
  return Math.min(60, Math.max(1, Math.trunc(n)));
}
