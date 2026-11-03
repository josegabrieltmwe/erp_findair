/**
 * Capa de acceso al endpoint `unified_consolidation_project` (hybrid auth:
 * sesión del ERP o Bearer). Envoltorio de respuesta: {success,result} o
 * {success:false,error,code,details}; con HTTP 4xx/5xx el http client compartido
 * lanza ApiError con el cuerpo en `details`. Aquí se normaliza a
 * ConsolidataError para que los stores no conozcan el formato.
 */
import { http } from "@shared/anagrafiche/services/http";
import { normalizeApiError } from "../logic";
import type {
  AnswerPayload,
  ApiMeta,
  BulkAssignResult,
  ConversionResult,
  ConversionStep,
  CreateFromOptionPayload,
  CreateProjectPayload,
  InternalNote,
  LegPayload,
  LogPage,
  OperateResult,
  PricePayload,
  ProjectDetail,
  ProjectRef,
  QueueCounts,
  QueuePage,
  QuoteRequest,
  QuoteResult,
  Readiness,
  ShipmentForm,
  ShipmentsView,
  StaffUser,
} from "../types";

const PATH = "/unified_consolidation_project";
/** Endpoint B del contrato (CONTRATTO.md): comparación sin crear proyecto. */
const QUOTE_PATH = "/unified_consolidation_quote";

interface Envelope<T> {
  success: boolean;
  result?: T;
  error?: string;
  code?: string;
  details?: unknown;
}

/** Error lanzado por el servicio: lleva el ConsolidataError normalizado. */
export class ConsolidataRequestError extends Error {
  readonly info: ReturnType<typeof normalizeApiError>;

  constructor(info: ReturnType<typeof normalizeApiError>) {
    super(info.message || info.code);
    this.name = "ConsolidataRequestError";
    this.info = info;
  }
}

async function unwrap<T>(call: Promise<Envelope<T>>): Promise<T> {
  let res: Envelope<T>;
  try {
    res = await call;
  } catch (err) {
    throw new ConsolidataRequestError(normalizeApiError(err));
  }
  if (!res || res.success !== true || res.result === undefined) {
    throw new ConsolidataRequestError(normalizeApiError(res));
  }
  return res.result;
}

export type QueryParams = Record<string, string | number>;

interface RequestOpts {
  signal?: AbortSignal;
}

function get<T>(query: QueryParams, opts: RequestOpts = {}): Promise<T> {
  return unwrap<T>(
    http<Envelope<T>>(
      PATH,
      opts.signal
        ? { method: "GET", query, signal: opts.signal }
        : { method: "GET", query },
    ),
  );
}

function post<T>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  return unwrap<T>(
    http<Envelope<T>>(PATH, { method: "POST", body: { action, ...body } }),
  );
}

/** Quita los campos vacíos del formulario de expedición antes de enviarlo. */
export function shipmentPayload(form: ShipmentForm): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ref: form.ref.trim(),
    orig_paese: form.orig_paese.trim().toUpperCase(),
    orig_cap: form.orig_cap.trim(),
    orig_citta: form.orig_citta.trim(),
    peso: form.peso,
  };
  if (form.orig_terminal.trim())
    out.orig_terminal = form.orig_terminal.trim().toUpperCase();
  if (form.colli) out.colli = form.colli;
  if (form.volume_cm3) out.volume_cm3 = form.volume_cm3;
  if (form.valore !== null && form.valore !== undefined)
    out.valore = form.valore;
  if (form.merce.trim()) out.merce = form.merce.trim();
  if (form.data_pronta) out.data_pronta = form.data_pronta;
  if (form.id_spedizione) out.id_spedizione = form.id_spedizione;
  return out;
}

/** Quita las claves vacías del alta (el API trata "" como ausente, pero así el cuerpo queda limpio). */
export function createPayload(
  p: CreateProjectPayload,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    titolo: p.titolo.trim(),
    tipo: p.tipo,
    id_cliente: p.id_cliente,
  };
  const hub = (p.hub_terminal ?? "").trim().toUpperCase();
  const dest = (p.dest_country ?? "").trim().toUpperCase();
  const eori = (p.eori_dichiarante ?? "").trim().toUpperCase();
  const note = (p.note_specialist ?? "").trim();
  if (hub) out.hub_terminal = hub;
  if (dest) out.dest_country = dest;
  if (eori) out.eori_dichiarante = eori;
  if (note) out.note_specialist = note;
  return out;
}

export const consolidataService = {
  /** view=queue con los parámetros ya construidos (buildConsolidataListQuery). */
  queue: (params: QueryParams, opts: RequestOpts = {}) =>
    get<QueuePage>({ ...params, view: "queue" }, opts),
  /** view=queue_counts: recuentos por fase con los mismos filtros. */
  queueCounts: (params: QueryParams, opts: RequestOpts = {}) =>
    get<{ counts: QueueCounts }>({ ...params, view: "queue_counts" }, opts),
  byCargo: (idCargo: number) =>
    get<{ items: ProjectRef[] }>({ view: "by_cargo", id_cargo: idCargo }),
  bySpedizione: (idSpedizione: number) =>
    get<{ items: ProjectRef[] }>({
      view: "by_spedizione",
      id_spedizione: idSpedizione,
    }),
  conversion: (id: number) =>
    get<{ passi: ConversionStep[] }>({ view: "conversion", id }),
  log: (id: number, page = 1, perPage = 20) =>
    get<LogPage>({ view: "log", id, page, per_page: perPage }),
  staffUsers: (q = "") =>
    get<{ items: StaffUser[] }>(
      q ? { view: "staff_users", q } : { view: "staff_users" },
    ),
  detail: (id: number) => get<ProjectDetail>({ id }),
  meta: () => get<ApiMeta>({ view: "meta" }),
  shipments: (id: number) => get<ShipmentsView>({ view: "shipments", id }),
  readiness: (id: number) => get<Readiness>({ view: "readiness", id }),
  notes: (id: number) => get<{ note: InternalNote[] }>({ view: "notes", id }),

  take: (id: number) => post<ProjectDetail>("take", { id }),
  assign: (id: number, user_id: number) =>
    post<ProjectDetail>("assign", { id, user_id }),
  noteInternal: (id: number, nota: string) =>
    post<{ note: InternalNote[] }>("note_internal", { id, nota }),
  answerQuote: (id: number, a: AnswerPayload) =>
    post<ProjectDetail>("answer_quote", { id, ...a }),
  overridePrice: (id: number, id_tratta: number, p: PricePayload) =>
    post<ProjectDetail>("override_price", { id, id_tratta, ...p }),
  /**
   * Aviso del proyecto (sin house): `id_prog_sped` se omite. El API lo lee como
   * entero y una clave ausente o nula vale 0, que es lo que guarda para el proyecto.
   */
  waiveWarning: (
    id: number,
    codice: string,
    id_prog_sped: number | null,
    motivo: string,
  ) =>
    post<{ codice: string; id_prog_sped: number; ignorato: boolean }>(
      "waive_warning",
      id_prog_sped !== null && id_prog_sped > 0
        ? { id, codice, id_prog_sped, motivo }
        : { id, codice, motivo },
    ),
  create: (p: CreateProjectPayload) =>
    post<ProjectDetail>("create", createPayload(p)),
  createFromOption: (p: CreateFromOptionPayload) =>
    post<{ progetto: ProjectDetail; spedizioni?: unknown }>(
      "create_from_option",
      { ...p },
    ),
  addLeg: (id: number, leg: LegPayload) =>
    post<ProjectDetail>("add_leg", { id, leg }),
  setEori: (id: number, eori: string) =>
    post<ProjectDetail>("set_eori", {
      id,
      eori_dichiarante: eori.trim().toUpperCase(),
    }),
  requestQuote: (id: number) => post<ProjectDetail>("request_quote", { id }),
  bulkAssign: (ids: number[], user_id: number) =>
    post<BulkAssignResult>("bulk_assign", { ids, user_id }),
  /** Conversión completa (idempotente: reintentar solo rehace lo que falló). */
  operate: (
    id: number,
    opts: { id_cargo?: number | null; reservar?: boolean } = {},
  ) => {
    const body: Record<string, unknown> = { id };
    if (opts.id_cargo) body.id_cargo = opts.id_cargo;
    if (opts.reservar) body.reservar = true;
    return post<OperateResult>("operate", body);
  },
  convert: (id: number, id_cargo: number) =>
    post<ConversionResult>("convert", { id, id_cargo }),

  addShipment: (id: number, form: ShipmentForm) =>
    post<ShipmentsView>("add_shipment", {
      id,
      spedizione: shipmentPayload(form),
    }),
  updateShipment: (id: number, id_sped: number, form: ShipmentForm) =>
    post<ShipmentsView>("update_shipment", {
      id,
      id_sped,
      spedizione: shipmentPayload(form),
    }),
  removeShipment: (id: number, id_sped: number) =>
    post<ShipmentsView>("remove_shipment", { id, id_sped }),

  recalc: (id: number) => post<ProjectDetail>("recalc", { id }),
  updateLeg: (id: number, id_tratta: number, leg: Record<string, unknown>) =>
    post<ProjectDetail>("update_leg", { id, id_tratta, leg }),
  removeLeg: (id: number, id_tratta: number) =>
    post<ProjectDetail>("remove_leg", { id, id_tratta }),
  close: (id: number) => post<ProjectDetail>("close", { id }),
  reopen: (id: number) => post<ProjectDetail>("reopen", { id }),
  cancel: (id: number) => post<ProjectDetail>("cancel", { id }),

  /** Compara "separado" vs "vía hub" sin crear ningún proyecto ni registro. */
  quote: (req: QuoteRequest) =>
    unwrap<QuoteResult>(
      http<Envelope<QuoteResult>>(QUOTE_PATH, { method: "POST", body: req }),
    ),
};
