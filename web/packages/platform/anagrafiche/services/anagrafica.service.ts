import { http } from './http';
import { paginated } from './normalizers';

/* =============================================================================
 * Anagrafica service — wraps /api_anagrafica_crud and exposes the full agregado
 * (anagrafica + sedi + banche + contatti + lettint + more) via ?include=.
 * ============================================================================ */

export interface AnagraficaLite {
  id: number;
  rag_soc: string;
  pi_cf?: string;
  nome_breve?: string;
  tipo?: string;
  stato?: string;
  [k: string]: unknown;
}

export interface SedeRow {
  id: number;
  id_anagrafica: number;
  label?: string;
  indirizzo?: string;
  citta?: string;
  prov?: string;
  cap?: string;
  id_paese_iso?: string;
  PEC?: string;
  cod_destin?: string;
  presa_fissa?: string;
  dhl_airport?: string;
  cargo_airport?: string;
  cargo_porto?: string;
  [k: string]: unknown;
}

export interface BancaRow {
  id: number;
  id_anagrafica: number;
  nome?: string;
  iban?: string;
  swift?: string;
  abi?: string;
  cab?: string;
  cc?: string;
  note?: string;
  [k: string]: unknown;
}

export interface ContattoRow {
  id: number;
  id_anagrafica: number;
  nome?: string;
  mail?: string;
  loginn?: string;
  ruolo?: string;
  /** Estado de acceso findair, incluido por el backend en el listado (batch). */
  findair_enabled?: boolean;
  findair_level?: 'basic' | 'full' | null;
  [k: string]: unknown;
}

export interface LettIntRow {
  id: number;
  id_anagrafica: number;
  // Nombres reales de la tabla dich_intenti_iva (Vat_Declaration_Model::ALLOWED_FIELDS).
  dichiaraz_intenti_numero?: string;
  dichiaraz_intenti_data?: string;
  dichiaraz_intenti_data_scad?: string;
  aliquota_IVA?: number;
  id_causale_IVA?: string;
  causale_IVA?: string;
  [k: string]: unknown;
}

export interface AnagraficaMore {
  id?: number;
  id_anagrafica?: number;
  dipendenti?: number;
  dipendenti2?: number;
  fatturato?: number;
  fatturato2?: number;
  tipo?: string;
  vs_italia?: string;
  vs_europa?: string;
  vs_asia?: string;
  vs_soviet?: string;
  vs_usa?: string;
  vs_africa?: string;
  vs_australia?: string;
  vs_nzeland?: string;
  vs_sudamerica?: string;
  text_quot_vettori?: string;
  b2b_footer?: string;
  issuing_carrier?: string;
  agent_iata_code?: string;
  at_place?: string;
  signature_ragsoc?: string;
  signature_agent?: string;
  [k: string]: unknown;
}

export interface AnagraficaDetail extends AnagraficaLite {
  sedi?: SedeRow[];
  banche?: BancaRow[];
  contatti?: ContattoRow[];
  lettint?: LettIntRow[];
  more?: AnagraficaMore | null;
}

/**
 * Filtros del listado. Paridad con el buscador legacy
 * (anagr_cerca.php → winbody.php?pp=anagr&ti=cerca): todos los campos del
 * formulario legacy tienen aquí su equivalente. El backend ya los acepta
 * (Anagrafica_Crud_Controller::get_filterable_fields + Anagrafica_Service::
 * list_anagrafiche), así que esto es solo la superficie cliente.
 */
export interface AnagraficaListFilters {
  page?: number;
  perPage?: number;
  search?: string;
  id?: string;
  /** Filtra por dueño de la anagrafica (FK `id_anagr_titolare`). */
  id_anagr_titolare?: string;
  tipo?: string;
  id_paese_iso?: string;
  bloccato?: string;
  vies_check?: string;
  // --- Identificación / texto (LIKE en backend) ---
  rag_soc?: string;
  pi_cf?: string;
  note?: string;
  // --- Localización (tabla sedi_interne) ---
  citta?: string;
  prov?: string;
  presafissa?: string;
  multisede?: string;
  // --- Pagos / facturación ---
  id_pagam_met?: string;
  id_pagam_scad?: string;
  tipo_pagamento?: string;
  esente_IVA?: string;
  fattura?: string;
  credito_residuo?: string;
  diritto_fisso?: string;
  fatt_sped_posta?: string;
  solleciti_invia?: string;
  id_banca_def?: string;
  valuta_sigla?: string;
  // --- Estado / clasificación ---
  legale?: string;
  origine_sito_pubbl?: string;
  metric_imperial?: string;
  id_agente?: string;
  // --- Especiales (semántica propia en el servicio) ---
  xpec?: string;
  xdestcode?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

/**
 * Campos que viajan como `filters[<campo>]`. `search` y la paginación van
 * aparte (params planos), y `sort`/`order` usan el formato JSON:API anidado.
 */
const FILTER_PARAM_FIELDS: Array<keyof AnagraficaListFilters> = [
  'id', 'id_anagr_titolare', 'tipo', 'id_paese_iso', 'bloccato', 'vies_check',
  'rag_soc', 'pi_cf', 'note',
  'citta', 'prov', 'presafissa', 'multisede',
  'id_pagam_met', 'id_pagam_scad', 'tipo_pagamento', 'esente_IVA', 'fattura',
  'credito_residuo', 'diritto_fisso', 'fatt_sped_posta', 'solleciti_invia',
  'id_banca_def', 'valuta_sigla',
  'legale', 'origine_sito_pubbl', 'metric_imperial', 'id_agente',
  'xpec', 'xdestcode',
];

export interface AnagraficaListResult {
  items: AnagraficaLite[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export type AnagraficaInclude = 'sedi' | 'banche' | 'contatti' | 'lettint' | 'more';

export interface AnagraficaUpdatePayload {
  [field: string]: unknown;
  more?: AnagraficaMore;
}

const ENDPOINT = '/api_anagrafica_crud';
const CLIENTS_ENDPOINT = '/api_anagrafica_clients';
const PARTNERS_ENDPOINT = '/api_anagrafica_partners';
const CLONE_ENDPOINT = '/api_anagrafica_clone';

/** Petición de clonación de una anagrafica. */
export interface AnagraficaCloneRequest {
  id_anagrafica: number;
  rag_soc: string;
  /** Simula sin escribir: devuelve el mismo reporte que la ejecución real. */
  dry_run?: boolean;
  /** Genera pi_cf/cf nuevos (por defecto true en el backend). */
  random_fiscal?: boolean;
  /** Reescribe los emails a @example.invalid. */
  mask_emails?: boolean;
}

/** Reporte devuelto por la clonación. */
export interface AnagraficaCloneReport {
  dry_run: boolean;
  new_id: number;
  rag_soc: string;
  rows_by_table: Record<string, number>;
  total_rows: number;
  logins: Array<{ nome: string; loginn_old: string; loginn_new: string }>;
  fiscal: Record<string, string>;
  warnings: string[];
}

/** Query params compartidos por `list()`/`listClients()` — mismo shape,
 *  distinto endpoint según cuál se llame. */
function buildListParams(filters: AnagraficaListFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: filters.page ?? 1,
    per_page: filters.perPage ?? 20,
  };
  if (filters.search) params.search = filters.search;
  // Los filtros viajan anidados como `filters[<campo>]` — NO confundir
  // `filters[id]` con `?id=N`, que el endpoint reserva para el detalle de una
  // anagrafica. Aquí es un filtro exacto del listado.
  for (const field of FILTER_PARAM_FIELDS) {
    const value = filters[field];
    if (value !== undefined && value !== null && value !== '') {
      params[`filters[${field}]`] = value as string | number;
    }
  }
  // El backend (Listable_Trait::parse_listing_request) SOLO acepta sort en
  // formato JSON:API anidado `?sort[<campo>]=<asc|desc>`; un `sort=<campo>`
  // plano se ignora (is_array check) y cae al orden por defecto. Ver
  // Anagrafica_Crud_Controller::get_list_anagrafiche + Listable_Trait:232.
  if (filters.sort) {
    params[`sort[${filters.sort}]`] = (filters.order ?? 'ASC').toLowerCase();
  }
  return params;
}

function toListResult(raw: unknown): AnagraficaListResult {
  const p = paginated<AnagraficaLite>(raw);
  return {
    items: p.items,
    total: p.total,
    page: p.page,
    perPage: p.perPage,
    pages: p.pages,
  };
}

export const anagraficaService = {
  async search(query: string, perPage = 25): Promise<AnagraficaLite[]> {
    const q = query.trim();
    const raw = await http<unknown>(ENDPOINT, {
      query: q ? { search: q, per_page: perPage } : { per_page: perPage },
    });
    const page = paginated<AnagraficaLite>(raw);
    return page.items;
  },

  async list(filters: AnagraficaListFilters = {}): Promise<AnagraficaListResult> {
    const raw = await http<unknown>(ENDPOINT, { query: buildListParams(filters) });
    return toListResult(raw);
  },

  /**
   * Listado de SOLO CLIENTES propios (`tipo='C'` forzado server-side,
   * `Anagrafica_Clients_Controller`) — respaldo real de "Clientes" en el
   * sidebar. `filters.tipo`, si viene, se ignora: el backend nunca lo lee,
   * así que enviarlo no cambiaría nada, pero tampoco se envía aquí para no
   * sugerir lo contrario.
   */
  async listClients(filters: AnagraficaListFilters = {}): Promise<AnagraficaListResult> {
    const { tipo: _ignoredTipo, ...rest } = filters;
    const raw = await http<unknown>(CLIENTS_ENDPOINT, { query: buildListParams(rest) });
    return toListResult(raw);
  },

  /**
   * Listado de SOLO PARTNERS (`tipo='P'` forzado server-side,
   * `Anagrafica_Partners_Controller`) — respaldo real del card "Partners"
   * en Settings > Anagráfica. `filters.tipo`, si viene, se ignora: el
   * backend nunca lo lee, así que enviarlo no cambiaría nada, pero tampoco
   * se envía aquí para no sugerir lo contrario.
   */
  async listPartners(filters: AnagraficaListFilters = {}): Promise<AnagraficaListResult> {
    const { tipo: _ignoredTipo, ...rest } = filters;
    const raw = await http<unknown>(PARTNERS_ENDPOINT, { query: buildListParams(rest) });
    return toListResult(raw);
  },

  async getById(id: number): Promise<AnagraficaLite | null> {
    if (!id || id <= 0) return null;
    try {
      const raw = await http<{ success?: boolean; data?: AnagraficaLite }>(ENDPOINT, {
        query: { id },
      });
      if (raw && typeof raw === 'object' && 'data' in raw && raw.data) {
        return raw.data as AnagraficaLite;
      }
      return null;
    } catch {
      return null;
    }
  },

  async getDetail(
    id: number,
    includes: AnagraficaInclude[] = ['sedi', 'banche', 'contatti', 'lettint', 'more'],
  ): Promise<AnagraficaDetail | null> {
    if (!id || id <= 0) return null;
    const raw = await http<{ success?: boolean; data?: AnagraficaDetail }>(ENDPOINT, {
      query: { id, include: includes.join(',') },
    });
    if (raw && typeof raw === 'object' && 'data' in raw && raw.data) {
      return raw.data as AnagraficaDetail;
    }
    return null;
  },

  async update(id: number, payload: AnagraficaUpdatePayload): Promise<AnagraficaDetail | null> {
    const body = { id, ...payload };
    const raw = await http<{ success?: boolean; data?: AnagraficaDetail; error?: string }>(ENDPOINT, {
      method: 'PATCH',
      query: { id, include: 'sedi,banche,contatti,lettint,more' },
      body,
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.data ?? null;
  },

  async create(payload: Record<string, unknown>): Promise<AnagraficaDetail> {
    const raw = await http<{ success?: boolean; data?: AnagraficaDetail; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: payload,
    });
    if (raw?.error) throw new Error(raw.error);
    if (!raw?.data) throw new Error('Server did not return created entity');
    return raw.data;
  },

  async remove(id: number): Promise<void> {
    const raw = await http<{ success?: boolean; error?: string }>(ENDPOINT, {
      method: 'DELETE',
      query: { id },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  /**
   * Clona una anagrafica (ficha, contatti, configuración y enlaces a listini).
   *
   * No duplica el catálogo de tarifas, que es compartido entre clientes: el
   * clon apunta a los mismos listini y por tanto cotiza igual que el origen.
   */
  async clone(payload: AnagraficaCloneRequest): Promise<AnagraficaCloneReport> {
    const raw = await http<{ data?: AnagraficaCloneReport; error?: string }>(CLONE_ENDPOINT, {
      method: 'POST',
      body: payload,
    });
    if (raw?.error) throw new Error(raw.error);
    if (!raw?.data) throw new Error('El servidor no devolvió el reporte de clonación');
    return raw.data;
  },
};
