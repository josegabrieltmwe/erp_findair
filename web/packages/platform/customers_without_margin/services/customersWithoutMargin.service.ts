import { http } from '../../anagrafiche/services/http';

/**
 * Clientes sin margen configurado (escalones `anagrafiche_scaglioni` del tipo pedido ni pactos por aerolínea).
 *
 * Sin margen, el motor de cargo devuelve las tarifas a coste y no seleccionables
 * (`not_selectable_reason: 'pricing_incomplete:no_margin_configured'`); este listado deja al personal encontrarlos
 * antes de que el operador se tope con ello al cotizar.
 *
 * Backend: `GET /api_customers_without_margin` (módulo `margenes_clientes`, scope `margins:read`).
 *   params: tipo ('A' por defecto; 'E'|'A'|'S'), q (razón social o id), page (1..), per_page (50, máx. 200),
 *           id_titolare (opcional, solo TMWE).
 *   respuesta: { success, data: { items[], total, page, per_page, tipo } }, ordenado por cargo_shipments_12m desc.
 * Alcance: TMWE ve todos los clientes activos; un partner solo los suyos (lo decide el API, la SPA no filtra).
 */

export type MarginTipo = 'E' | 'A' | 'S';

export interface CustomerWithoutMargin {
  id: number;
  ragione_sociale: string;
  id_titolare: number;
  titolare: string;
  /** 'YYYY-MM-DD' o null. */
  alta: string | null;
  cargo_shipments_12m: number;
}

export interface CustomersWithoutMarginQuery {
  tipo?: MarginTipo;
  q?: string;
  page?: number;
  perPage?: number;
  idTitolare?: number | null;
}

export interface CustomersWithoutMarginPage {
  items: CustomerWithoutMargin[];
  total: number;
  page: number;
  perPage: number;
  tipo: MarginTipo;
}

export const MARGIN_TIPOS: readonly MarginTipo[] = ['A', 'E', 'S'];
export const DEFAULT_PER_PAGE = 50;
export const MAX_PER_PAGE = 200;

const ENDPOINT = '/api_customers_without_margin';

function isTipo(v: unknown): v is MarginTipo {
  return typeof v === 'string' && (MARGIN_TIPOS as readonly string[]).includes(v);
}

function toInt(v: unknown, fallback: number): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
}

/** Parámetros de la petición, normalizados como los acepta el API (los vacíos no viajan). */
export function buildCustomersWithoutMarginQuery(p: CustomersWithoutMarginQuery = {}): Record<string, string | number> {
  const query: Record<string, string | number> = {
    tipo: isTipo(p.tipo) ? p.tipo : 'A',
    page: Math.max(1, toInt(p.page, 1)),
    per_page: Math.min(MAX_PER_PAGE, Math.max(1, toInt(p.perPage, DEFAULT_PER_PAGE))),
  };
  const q = (p.q ?? '').trim();
  if (q) query.q = q;
  const titolare = toInt(p.idTitolare, 0);
  if (titolare > 0) query.id_titolare = titolare;
  return query;
}

function normalizeItem(raw: Partial<CustomerWithoutMargin> | null | undefined): CustomerWithoutMargin {
  const r = raw ?? {};
  return {
    id: toInt(r.id, 0),
    ragione_sociale: String(r.ragione_sociale ?? ''),
    id_titolare: toInt(r.id_titolare, 0),
    titolare: String(r.titolare ?? ''),
    alta: r.alta ? String(r.alta) : null,
    cargo_shipments_12m: toInt(r.cargo_shipments_12m, 0),
  };
}

/** Cuerpo del API -> página tipada. Tolera campos ausentes (se piden los que se enviaron). */
export function parseCustomersWithoutMargin(
  raw: unknown,
  sent: Record<string, string | number>,
): CustomersWithoutMarginPage {
  const data = ((raw as { data?: Record<string, unknown> } | null)?.data ?? {}) as {
    items?: Array<Partial<CustomerWithoutMargin>>;
    total?: unknown;
    page?: unknown;
    per_page?: unknown;
    tipo?: unknown;
  };
  const items = Array.isArray(data.items) ? data.items.map(normalizeItem) : [];
  return {
    items,
    total: Math.max(items.length, toInt(data.total, items.length)),
    page: Math.max(1, toInt(data.page, Number(sent.page) || 1)),
    perPage: Math.max(1, toInt(data.per_page, Number(sent.per_page) || DEFAULT_PER_PAGE)),
    tipo: isTipo(data.tipo) ? data.tipo : (sent.tipo as MarginTipo),
  };
}

export const customersWithoutMarginService = {
  async list(p: CustomersWithoutMarginQuery = {}): Promise<CustomersWithoutMarginPage> {
    const query = buildCustomersWithoutMarginQuery(p);
    const raw = await http<unknown>(ENDPOINT, { query });
    return parseCustomersWithoutMargin(raw, query);
  },
};

/** Páginas totales (al menos 1, para que la paginación no desaparezca con 0 resultados). */
export function pageCount(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, perPage)));
}

/**
 * Destino de «Configurar margen»: pestaña de márgenes (escalones) de la ficha del cliente.
 * El tipo viaja en `?tipo=` solo si no es el de por defecto de la pestaña ('A', aéreo).
 */
export function marginConfigRoute(
  clientId: number,
  tipo: MarginTipo = 'A',
): { name: string; params: { id: string; tab: string }; query: Record<string, string> } {
  return {
    name: 'anagrafica-detail-tab',
    params: { id: String(clientId), tab: 'margini_cargo' },
    query: tipo === 'A' ? {} : { tipo },
  };
}
