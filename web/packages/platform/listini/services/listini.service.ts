import { http } from '../../anagrafiche/services/http';
import { paginated, unwrap } from '../../anagrafiche/services/normalizers';
import type { Paginated } from '../../anagrafiche/services/api.types';

/**
 * Price lists (listini): list definitions, their pack variants (listini_pack),
 * price matrices (zona × peso) and supplements. Migrated from V1
 * `price_list_config.js`.
 *
 * Backend:
 *   - GET/POST/PATCH/DELETE /api_listini             (list/create/update/soft-delete)
 *   - GET/POST/PATCH/DELETE /api_listini_pack        (pack variants CRUD)
 *   - GET/POST/PUT          /api_listini_prices       (price matrix read / upsert)
 *   - GET                   /api_listini_supplements  (read-only)
 *   - GET                   /api_listini_export        (RabbitMQ RPC → base64 file)
 */

export type ListinoTipo = 'C' | 'F' | 'R';
export type PackKind = 'D' | 'U' | 'P' | 'Ps' | 'Pm';

export interface ListinoLite {
  id: number;
  nome: string;
  nome_servdhl?: string;
  tipo?: ListinoTipo;
  id_servizi?: number | string;
  id_fornitore?: number | string;
  fornitore_nome?: string;
  id_anagr_titolare?: number;
  listino_base?: 'S' | 'N';
  attivo?: 'S' | 'N';
  valuta_sigla?: string;
  servizio_nome?: string;
  clients_count?: number;
  has_problems?: boolean;
  insert_datetime?: string;
  [k: string]: unknown;
}

export interface ListinoFilters {
  search?: string;
  tipo?: ListinoTipo | '';
  attivo?: 'S';
  id_fornitore?: number | string;
  listino_base?: 'S' | 'N' | '';
  /** Perfil al que se aplica `listino_base`: C | P | O | M. */
  base_profile?: BasePerfil | '';
  pack?: string;
  paese_part?: string;
  paese_dest?: string;
  valuta_sigla?: string;
  maggiorazione?: 'S' | 'N' | '';
  cod?: string;
  problemi?: 'S' | '';
  sort?: string;
  dir?: 'asc' | 'desc';
  list_id?: number;
}

export interface ListinoCreatePayload {
  nome: string;
  tipo: ListinoTipo;
  id_servizi?: number | string;
  id_fornitore?: number | string;
  id_anagr_titolare?: number;
}

export interface ListinoUpdatePayload {
  nome?: string;
  attivo?: 'S' | 'N';
}

export type SupplementColumn =
  | 'costo_fisso'
  | 'costo_min'
  | 'costo_max'
  | 'costo_kg'
  | 'costo_collo'
  | 'costo_gg'
  | 'costo_perc';

export interface SupplementEditorData {
  types: Array<{ id: number | string; nome: string; gruppo: number | string; orderby: number | string }>;
  values: Record<string, Partial<Record<SupplementColumn, number>>>;
  version: { data_start: string; data_stop: string } | null;
  future: { data_start: string; data_stop: string } | null;
}

export interface MatrixFull {
  prices: ListinoPrice[];
  ext_prices: ListinoPrice[];
  metadata: Record<string, unknown> | null;
  zone_names: Record<string, string>;
  versions: ListinoVersion[];
  zones_ko: Array<number | string>;
}

export interface ListinoClients {
  total: number;
  items: Array<{
    id: number;
    id_anagrafica: number;
    rag_soc: string | null;
    nome_breve: string | null;
    id_servizio: number;
    servizio_nome: string | null;
    tipo: 'L' | 'P';
    coefficiente: number | string;
  }>;
}

export interface SheetCell {
  value: string;
  ok: boolean;
}

export interface SheetRow {
  first: string;
  first_ok: boolean;
  num: number | null;
  cells: Record<string, Record<string, SheetCell>>;
}

export interface SheetInterpretation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  tipo_cl: 'P' | 'B' | 'M' | 'C';
  flags: { collo2: boolean; base: boolean; min: boolean; num_bnc: boolean };
  labels: { peso: string; prezzo: string; prezzo2: string; zone: string; valuta: string };
  zones: string[];
  suppl: Array<{ id: number; nome: string } & Record<string, number | string>>;
  ext: SheetRow | null;
  scagl: SheetRow[];
}

export interface UpdateLogRow {
  id: number;
  id_listino_pack: number;
  operazione: string;
  data_start: string;
  data_stop: string;
  insert_datetime: string;
  insert_user: number;
  insert_IP: string;
}

/** Tipo de aviso de un pack: '' = API, '_zn' = zonas, '_prz' = precios. */
export type AlertType = '' | '_zn' | '_prz';

export type BasePerfil = 'C' | 'P' | 'O' | 'M';

export interface BaseCheck {
  status: 'OK' | 'KO';
  id: number;
  previous_id: number | null;
  previous_name: string | null;
  message: string;
}

/** Parámetros de la modificación múltiple (formulario de listyupd_multi). */
export interface BulkParams {
  imp_zon?: string;
  imp_bas?: string;
  imp_min?: string;
  opx_fix: 'ALL' | 'NEW';
  /** Operación por columna de suplemento: fix|min|max|akg|bnc|agg|prc → FIX|PRC. */
  oprz?: Record<string, 'FIX' | 'PRC'>;
  /** Valores por columna y suplemento: spp[columna][id_supplementi]. */
  spp?: Record<string, Record<number, string>>;
}

export interface BulkListinoResult {
  listino_id: number;
  status: string;
  packs: Array<{ pack_id: number; status: string }>;
}

export interface BulkBatch {
  batch: string;
  packs: number;
  listini: number;
  user: number;
  undone: boolean;
}

export interface ListinoVersion {
  data_start: string;
  data_stop: string;
  estado: 'in_corso' | 'futuro' | 'scaduto';
}

export interface ListinoPack {
  id: number;
  id_listino: number;
  pack: PackKind;
  cod_cliente_fornitore?: string;
  valuta_sigla?: string;
  metric_imperial?: 'M' | 'I';
  note?: string;
  [k: string]: unknown;
}

export type YesNo = 'S' | 'N';

export interface ListinoPackPayload {
  id?: number;
  id_listino?: number;
  pack?: PackKind;
  cod_cliente_fornitore?: string;
  cod_fornitore?: string;
  cod_fornitore2?: string;
  cod_dhl_xml?: string;
  paese_part?: string;
  paese_dest?: string;
  valuta_sigla?: string;
  metric_imperial?: 'M' | 'I';
  peso_bancale?: 'P' | 'M' | 'B';
  usa_num_coll_bank?: YesNo;
  collo_sing_peso?: YesNo;
  costo_a_collo2?: YesNo;
  moltipl_step?: YesNo;
  moltipl_ogni_x_kg?: number;
  usa_costo_base?: YesNo;
  usa_costo_min?: YesNo;
  maggiorazione?: number;
  id_listino_nome_magg?: number;
  note?: string;
  attivo?: YesNo;
}

/** Respuesta de `op=new_version` (ver Listini_Prices_Controller::handle_new_version). */
export interface NewVersionResult {
  pack_id: number;
  /** Caso aplicado (1-5), paridad con `$opzdt` del legacy. */
  opzdt: number;
  /** Descripción legible de la operación realizada. */
  operazione: string;
  version: { data_start: string; data_stop: string };
  /** Versión que se cerró para dar paso a la nueva (null si no había). */
  closed_version: { data_start: string; data_stop: string } | null;
  rows_inserted: number;
  closed_rows: number;
}

export interface ListinoPrice {
  peso_max: number | string;
  zona: number | string;
  prezzo: number | string;
  [k: string]: unknown;
}

export interface ListinoSupplement {
  id: number;
  id_supplementi?: number | string;
  costo_fisso?: number | string;
  costo_kg?: number | string;
  costo_perc?: number | string;
  [k: string]: unknown;
}

export interface ListinoExportFile {
  file: string;
  filename?: string;
  format?: string;
  mime_type?: string;
}

export interface ImportFormat {
  id: string;
  name: string;
  description: string;
  file_types: string[];
  example_headers: string[];
}

export interface ImportPreview {
  pack_id: number;
  format: string;
  valid_rows: number;
  error_rows: number;
  zones_detected: Array<number | string>;
  new_zones: Array<number | string>;
  warnings: string[];
  errors: Array<Record<string, unknown>>;
  sample_valid: ListinoPrice[];
  /** Full validated rows, used for the JSON confirm PUT. */
  valid_rows_data: ListinoPrice[];
}

export interface ImportResult {
  inserted: number;
  updated: number;
  deleted: number;
  [k: string]: unknown;
}

export type ImportMode = 'merge' | 'replace';

/** Client → service → listino assignment (anagrafiche_listvol). */
export interface ListinoAssignment {
  id: number;
  id_anagrafica: number | string;
  id_servizio?: number | string;
  id_listino_nome?: number | string;
  tipo?: string;
  coefficiente?: number | string;
  fuel_surc?: number | string;
  [k: string]: unknown;
}

export interface AssignmentFilters {
  id_anagrafica?: number;
  id_listino_nome?: number;
  id_servizio?: number;
}

const ENDPOINT = '/api_listini';
const PACK = '/api_listini_pack';
const PRICES = '/api_listini_prices_web';
const BULK = '/api_listini_bulk_web';
const PROBLEMS = '/api_listini_problems_web';
const SUPPLEMENTS = '/api_listini_supplements_web';
const EXPORT = '/api_listini_export_web';
const IMPORT = '/api_listini_import_web';
const ASSIGNMENTS = '/api_listini_assignments_web';

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  id?: number;
  [k: string]: unknown;
}

function assertOk(raw: RawWriteResponse | undefined, fallback: string): void {
  if (raw?.error) throw new Error(raw.error);
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

function toArray<T>(raw: unknown, ...keys: string[]): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const r = unwrap<unknown>(raw);
    if (Array.isArray(r)) return r as T[];
    if (r && typeof r === 'object') {
      for (const k of keys) {
        const v = (r as Record<string, unknown>)[k];
        if (Array.isArray(v)) return v as T[];
      }
    }
    for (const k of keys) {
      const v = (raw as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

export const listiniService = {
  // ── Lists ──
  async list(page: number, filters: ListinoFilters = {}, perPage = 30): Promise<Paginated<ListinoLite>> {
    const query: Record<string, string | number> = { page, per_page: perPage };
    if (filters.search) query.search = filters.search;
    if (filters.tipo) query.tipo = filters.tipo;
    if (filters.attivo) query.attivo = filters.attivo;
    if (filters.id_fornitore) query.id_fornitore = filters.id_fornitore;
    if (filters.listino_base) query.listino_base = filters.listino_base;
    for (const k of ['base_profile', 'pack', 'paese_part', 'paese_dest', 'valuta_sigla', 'maggiorazione', 'cod', 'problemi', 'sort', 'dir', 'list_id'] as const) {
      const v = filters[k];
      if (v) query[k] = v as string | number;
    }
    const raw = await http<unknown>(ENDPOINT, { query });
    return paginated<ListinoLite>(raw);
  },

  async search(query: string, perPage = 25): Promise<ListinoLite[]> {
    const q = query.trim();
    const params: Record<string, string | number> = { per_page: perPage };
    if (q) params.search = q;
    const raw = await http<unknown>(ENDPOINT, { query: params });
    if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
      const arr = unwrap<ListinoLite[]>(raw);
      return Array.isArray(arr) ? arr : [];
    }
    const page = paginated<ListinoLite>(raw, 'data');
    return page.items;
  },

  async getById(id: number): Promise<ListinoLite | null> {
    if (!id) return null;
    try {
      const raw = await http<unknown>(ENDPOINT, { query: { id } });
      const r = unwrap<ListinoLite | ListinoLite[]>(raw);
      if (Array.isArray(r)) return r[0] ?? null;
      return r ?? null;
    } catch {
      return null;
    }
  },

  async create(payload: ListinoCreatePayload): Promise<RawWriteResponse> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
    return raw;
  },

  /** Clona un listino completo (nombre+pack+precios+suplementos vigentes). */
  async clone(sourceListinoNomeId: number, nome: string): Promise<{ listino_nome_id: number; pack_id: number }> {
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'clone', source_listino_nome_id: sourceListinoNomeId, nome },
    });
    assertOk(raw, 'Clone failed');
    return (raw as { data?: { listino_nome_id: number; pack_id: number } }).data ?? { listino_nome_id: 0, pack_id: 0 };
  },

  async update(id: number, payload: ListinoUpdatePayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'PATCH',
      query: { id: String(id) },
      body: payload,
    });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', query: { id: String(id) } });
    assertOk(raw, 'Delete failed');
  },

  /** Clientes con un listino asignado (vista inversa, solo TMWE). */
  async listinoClients(listinoId: number): Promise<ListinoClients> {
    const raw = await http<unknown>(ASSIGNMENTS, { query: { id_listino_nome: String(listinoId) } });
    return unwrap<ListinoClients>(raw) ?? { total: 0, items: [] };
  },

  /** Historial de operaciones sobre las versiones de un listino (listini_update). */
  async updateLog(listinoId: number): Promise<UpdateLogRow[]> {
    const raw = await http<unknown>(ENDPOINT, { query: { id: String(listinoId), log: 1 } });
    return unwrap<{ log: UpdateLogRow[] }>(raw)?.log ?? [];
  },

  // ── Avisos de problemas de un pack ──
  async problemAlert(packId: number, tp: AlertType): Promise<{ message: string; delete_zones: string[] }> {
    const raw = await http<unknown>(PROBLEMS, { query: { pack_id: String(packId), tp } });
    const d = unwrap<{ message?: string; delete_zones?: string[] }>(raw);
    return { message: d?.message ?? '', delete_zones: d?.delete_zones ?? [] };
  },

  async problemReset(packId: number, tp: AlertType): Promise<void> {
    const raw = await http<RawWriteResponse>(PROBLEMS, { method: 'POST', body: { op: 'reset', pack_id: packId, tp } });
    assertOk(raw, 'Reset failed');
  },

  /** Retira (archiva) los precios de zonas que el servicio no preve. Devuelve filas archivadas. */
  async problemDeleteZones(packId: number, zones: string[]): Promise<number> {
    const raw = await http<RawWriteResponse>(PROBLEMS, {
      method: 'POST',
      body: { op: 'delete_zones', pack_id: packId, zones },
    });
    assertOk(raw, 'Delete zones failed');
    return unwrap<{ archived_rows: number }>(raw)?.archived_rows ?? 0;
  },

  /** Recalcula los avisos de todos los listini (el cron del legacy). Solo TMWE. */
  async problemsRefresh(): Promise<{ packs: number; flagged: number }> {
    const raw = await http<RawWriteResponse>(PROBLEMS, { method: 'POST', body: { op: 'refresh' } });
    assertOk(raw, 'Refresh failed');
    return unwrap<{ packs: number; flagged: number }>(raw);
  },

  // ── Listino base (C/P/O/M) ──
  /** Confirmación previa a marcar un listino como base de su servicio. */
  async baseCheck(id: number, profile: BasePerfil): Promise<BaseCheck> {
    const raw = await http<unknown>(ENDPOINT, { query: { op: 'base_check', id: String(id), profile } });
    return unwrap<BaseCheck>(raw);
  },

  async setBase(id: number, profile: BasePerfil, previousId?: number | null): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'set_base', id, profile, ...(previousId ? { previous_id: previousId } : {}) },
    });
    assertOk(raw, 'Set base failed');
  },

  // ── Bulk % update with undo (admin) ──
  async bulkNewBatch(): Promise<string> {
    const raw = await http<unknown>(BULK, { query: { op: 'new_batch' } });
    return unwrap<{ batch: string }>(raw).batch;
  },

  async bulkApply(batch: string, listinoIds: number[], params: BulkParams): Promise<BulkListinoResult[]> {
    const raw = await http<RawWriteResponse>(BULK, {
      method: 'POST',
      body: { op: 'apply', batch, listino_ids: listinoIds, params },
    });
    assertOk(raw, 'Bulk update failed');
    return unwrap<{ results: BulkListinoResult[] }>(raw).results ?? [];
  },

  async bulkUndo(batch: string): Promise<{ packs: number; restored: number; archived: number; skipped: number }> {
    const raw = await http<RawWriteResponse>(BULK, { method: 'POST', body: { op: 'undo', batch } });
    assertOk(raw, 'Undo failed');
    return unwrap<{ packs: number; restored: number; archived: number; skipped: number }>(raw);
  },

  async bulkHistory(limit = 30): Promise<BulkBatch[]> {
    const raw = await http<unknown>(BULK, { query: { op: 'history', limit: String(limit) } });
    return unwrap<{ batches: BulkBatch[] }>(raw)?.batches ?? [];
  },

  /** Catálogo de tipos de suplemento (id, nombre). */
  async supplementTypes(): Promise<Array<{ id: number; nome: string }>> {
    const raw = await http<unknown>(SUPPLEMENTS, { query: { types: 1 } });
    const d = unwrap<Array<{ id: number | string; nome: string }>>(raw);
    return (Array.isArray(d) ? d : []).map((x) => ({ id: Number(x.id), nome: String(x.nome) }));
  },

  // ── Pack variants ──
  async listPacks(listinoId: number): Promise<ListinoPack[]> {
    const raw = await http<unknown>(PACK, { query: { listino_id: listinoId } });
    return toArray<ListinoPack>(raw, 'data', 'items', 'packs');
  },

  async savePack(payload: ListinoPackPayload): Promise<RawWriteResponse> {
    const isCreate = !payload.id;
    const raw = await http<RawWriteResponse>(PACK, {
      method: isCreate ? 'POST' : 'PATCH',
      query: isCreate ? undefined : { id: String(payload.id) },
      // El backend espera `listino_id` (o `id_listino_nome`) para crear.
      body: isCreate ? { ...payload, listino_id: payload.id_listino } : payload,
    });
    assertOk(raw, isCreate ? 'Create failed' : 'Update failed');
    return raw;
  },

  async removePack(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(PACK, { method: 'DELETE', query: { id: String(id) } });
    assertOk(raw, 'Delete failed');
  },

  // ── Price matrix ──
  async getMatrix(packId: number, date?: string): Promise<ListinoPrice[]> {
    const raw = await http<unknown>(PRICES, { query: { pack_id: packId, ...(date ? { date } : {}) } });
    // V1 tolerates several shapes: {data:{prices}}, {prices}, {matrix}, [].
    if (Array.isArray(raw)) return raw as ListinoPrice[];
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const inner = (obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj);
      const prices = inner.prices ?? obj.prices ?? obj.matrix ?? obj.data;
      if (Array.isArray(prices)) return prices as ListinoPrice[];
    }
    return [];
  },

  /**
   * Matriz + metadatos de un pack en una sola llamada: filas de precio (con
   * prezzo2, base y mínimo), peso extra, flags del pack, nombres de zona,
   * versiones temporales y zonas KO. `date` pide la versión vigente en esa fecha.
   */
  async getMatrixFull(packId: number, date?: string): Promise<MatrixFull> {
    const raw = await http<unknown>(PRICES, {
      query: { pack_id: packId, enriched: 1, ...(date ? { date } : {}) },
    });
    const d = unwrap<{
      prices?: ListinoPrice[];
      zones_ko?: Array<Record<string, unknown>>;
      enriched?: {
        metadata?: Record<string, unknown> | null;
        zone_names?: Record<string, string>;
        ext_prices?: ListinoPrice[];
        versions?: ListinoVersion[];
      };
    }>(raw);
    const e = d?.enriched ?? {};
    return {
      prices: d?.prices ?? [],
      ext_prices: e.ext_prices ?? [],
      metadata: e.metadata ?? null,
      zone_names: e.zone_names ?? {},
      versions: e.versions ?? [],
      zones_ko: (d?.zones_ko ?? []).map((z) => (z.zona ?? z) as number | string),
    };
  },

  /** Quita una versión futura: la vigente recupera su fin de validez. */
  async deleteFutureVersion(packId: number, start: string, stop: string): Promise<void> {
    const raw = await http<RawWriteResponse>(PRICES, {
      method: 'DELETE',
      query: { pack_id: String(packId), version_start: start, version_stop: stop },
    });
    assertOk(raw, 'Delete version failed');
  },

  async saveMatrix(packId: number, prices: ListinoPrice[]): Promise<void> {
    const raw = await http<RawWriteResponse>(PRICES, {
      method: 'PUT',
      query: { pack_id: String(packId) },
      body: { prices },
    });
    assertOk(raw, 'Save failed');
  },

  /**
   * Publica una NUEVA VERSIÓN del listino con fecha de entrada en vigor, en vez
   * de sobrescribir la vigente (que es lo que hace `saveMatrix`).
   *
   * Es el equivalente moderno de la gestión de versiones del legacy
   * (`listy_gestnew_exe.php`, los 5 casos `opzdt`): el backend cierra la versión
   * anterior (`data_stop = <nueva fecha>`) e inserta las filas nuevas, dentro de
   * una transacción y detectando solapamientos — algo que el legacy NO hacía.
   *
   * @param dataStart Fecha de entrada en vigor (YYYY-MM-DD). Vacío = ahora.
   * @param dataStop  Fin de vigencia opcional; por defecto el centinela 2050.
   */
  async saveMatrixAsNewVersion(
    packId: number,
    prices: ListinoPrice[],
    dataStart: string,
    dataStop?: string,
    extPrices?: ListinoPrice[],
  ): Promise<NewVersionResult> {
    const raw = await http<RawWriteResponse>(PRICES, {
      method: 'POST',
      body: {
        op: 'new_version',
        pack_id: packId,
        data_start: dataStart,
        ...(dataStop ? { data_stop: dataStop } : {}),
        prices,
        // Sin esta clave el backend arrastra el peso extra de la versión anterior.
        ...(extPrices ? { ext_prices: extPrices } : {}),
      },
    });
    assertOk(raw, 'New version failed');
    return unwrap<NewVersionResult>(raw);
  },

  // ── KO zones (zones the price list does NOT serve) ──
  /** Returns the list of KO zone codes for a pack. */
  async getZonesKo(packId: number): Promise<Array<number | string>> {
    const raw = await http<unknown>(PRICES, { query: { pack_id: packId } });
    const data = unwrap<{ zones_ko?: Array<Record<string, unknown>> }>(raw);
    const list = data?.zones_ko ?? [];
    return list.map((z) => (z.zona ?? z) as number | string);
  },

  /** Add or remove a zone from the KO list. */
  async setZoneKo(packId: number, zona: number | string, action: 'add' | 'remove'): Promise<void> {
    const raw = await http<RawWriteResponse>(PRICES, {
      method: 'POST',
      body: { pack_id: packId, action: 'zone_ko', ko_action: action, zona: String(zona) },
    });
    assertOk(raw, 'KO zone update failed');
  },

  // ── Supplements ──
  /** Catálogo + importes vigentes del modal de suplementos (paridad listy_suppl_ajax). */
  async getSupplementEditor(packId: number): Promise<SupplementEditorData> {
    const raw = await http<unknown>(SUPPLEMENTS, { query: { pack_id: packId, editor: 1 } });
    const d = unwrap<SupplementEditorData>(raw);
    return d ?? { types: [], values: {}, version: null, future: null };
  },

  /**
   * Guarda los suplementos. ACT actualiza la versión vigente (y la futura) sin
   * tocar fechas; NEW abre una versión nueva copiando precios y peso extra.
   * Como en el legacy, lo que no se envía de un suplemento existente queda a 0:
   * hay que mandar el conjunto completo.
   */
  async saveSupplements(
    packId: number,
    mode: 'ACT' | 'NEW',
    ids: number[],
    values: Record<number, Partial<Record<SupplementColumn, number>>>,
  ): Promise<{ changed: boolean }> {
    const raw = await http<RawWriteResponse>(SUPPLEMENTS, {
      method: 'POST',
      body: { op: 'save', pack_id: packId, mode, ids, values },
    });
    assertOk(raw, 'Save failed');
    return unwrap<{ changed: boolean }>(raw) ?? { changed: true };
  },

  async getSupplements(packId: number): Promise<ListinoSupplement[]> {
    const raw = await http<unknown>(SUPPLEMENTS, { query: { pack_id: packId } });
    if (Array.isArray(raw)) return raw as ListinoSupplement[];
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const inner = (obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj);
      const supp = inner.supplements ?? obj.supplements ?? obj.items ?? obj.data;
      if (Array.isArray(supp)) return supp as ListinoSupplement[];
    }
    return [];
  },

  // ── Excel export (RabbitMQ RPC) ──
  /**
   * @param opts.section 'prices' (matriz) o 'supplements' (solo con format csv)
   * @param opts.date    Fecha de la versión a exportar (YYYY-MM-DD); vacío = vigente
   */
  async exportExcel(
    packId: number,
    format: 'xlsx' | 'csv' | 'sheet' = 'xlsx',
    opts: { section?: 'prices' | 'supplements'; date?: string } = {},
  ): Promise<ListinoExportFile> {
    const query: Record<string, string | number> = { pack_id: packId, format };
    if (opts.section) query.section = opts.section;
    if (opts.date) query.date = opts.date;
    const raw = await http<unknown>(EXPORT, { query });
    const data = (raw && typeof raw === 'object' && 'data' in raw
      ? (raw as { data: unknown }).data
      : raw) as Partial<ListinoExportFile> | null;
    if (!data || typeof data !== 'object' || typeof data.file !== 'string') {
      throw new Error('No file data in response');
    }
    return {
      file: data.file,
      filename: data.filename,
      format: data.format ?? format,
      mime_type: data.mime_type,
    };
  },

  // ── Hoja de gestión (pegar desde Excel) ──
  /** Fase C del legacy: lee la hoja y devuelve lo interpretado y los errores. No escribe. */
  async sheetValidate(packId: number, sheet: string): Promise<SheetInterpretation> {
    const raw = await http<RawWriteResponse>(IMPORT, {
      method: 'POST',
      body: { op: 'sheet_validate', pack_id: packId, sheet },
    });
    assertOk(raw, 'Sheet validation failed');
    return unwrap<SheetInterpretation>(raw);
  },

  /** Fase A: vuelve a validar y escribe según las fechas (caso de versión 1-5 del legacy). */
  async sheetApply(packId: number, sheet: string, start: string, stop: string): Promise<{ operazione: string; rows_inserted: number }> {
    const raw = await http<RawWriteResponse>(IMPORT, {
      method: 'POST',
      body: { op: 'sheet_apply', pack_id: packId, sheet, start, stop },
    });
    assertOk(raw, 'Sheet apply failed');
    return unwrap<{ operazione: string; rows_inserted: number }>(raw);
  },

  // ── Import (CSV/Excel) ──
  async importFormats(): Promise<ImportFormat[]> {
    const raw = await http<unknown>(IMPORT, { query: { action: 'formats' } });
    return toArray<ImportFormat>(raw, 'formats');
  },

  /** Step 1: upload file, parse + validate, return preview (no persistence). */
  async importPreview(packId: number, file: File, format = 'express'): Promise<ImportPreview> {
    const form = new FormData();
    form.append('file', file);
    // pack_id/format go in the query string: the controller reads them via
    // get_parameter(), and PHP does not surface multipart text fields through
    // the JSON-oriented get_from_post() helper.
    const raw = await http<unknown>(IMPORT, {
      method: 'POST',
      query: { pack_id: String(packId), format },
      body: form,
    });
    const data = unwrap<ImportPreview>(raw);
    if (!data || typeof data !== 'object') throw new Error('Invalid import preview response');
    return data;
  },

  /** Step 2: confirm import with the validated rows from the preview. */
  async importConfirm(
    packId: number,
    rows: ListinoPrice[],
    mode: ImportMode = 'merge',
    format = 'express',
    supplMode: 'ACT' | 'NEW' = 'NEW',
  ): Promise<ImportResult> {
    const raw = await http<RawWriteResponse>(IMPORT, {
      method: 'PUT',
      body: { pack_id: packId, mode, rows, format, ...(format === 'supplements' ? { suppl_mode: supplMode } : {}) },
    });
    assertOk(raw, 'Import failed');
    return unwrap<ImportResult>(raw) ?? { inserted: 0, updated: 0, deleted: 0 };
  },

  // ── Client assignments (anagrafiche_listvol) ──
  async listAssignments(filters: AssignmentFilters = {}): Promise<ListinoAssignment[]> {
    const query: Record<string, string | number> = {};
    if (filters.id_anagrafica) query.id_anagrafica = filters.id_anagrafica;
    if (filters.id_listino_nome) query.id_listino_nome = filters.id_listino_nome;
    if (filters.id_servizio) query.id_servizio = filters.id_servizio;
    const raw = await http<unknown>(ASSIGNMENTS, { query });
    return toArray<ListinoAssignment>(raw, 'assignments', 'items');
  },

  async createAssignment(payload: Partial<ListinoAssignment>): Promise<RawWriteResponse> {
    const raw = await http<RawWriteResponse>(ASSIGNMENTS, { method: 'POST', body: payload });
    assertOk(raw, 'Create assignment failed');
    return raw;
  },

  async updateAssignment(id: number, payload: Partial<ListinoAssignment>): Promise<void> {
    const raw = await http<RawWriteResponse>(ASSIGNMENTS, {
      method: 'PATCH',
      query: { id },
      body: payload,
    });
    assertOk(raw, 'Update assignment failed');
  },

  async removeAssignment(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ASSIGNMENTS, { method: 'DELETE', query: { id } });
    assertOk(raw, 'Delete assignment failed');
  },
};
