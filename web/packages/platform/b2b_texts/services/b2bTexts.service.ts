import { http } from '../../anagrafiche/services/http';
import { paginated } from '../../anagrafiche/services/normalizers';
import type { Paginated } from '../../anagrafiche/services/api.types';

/**
 * Traducciones del sitio B2B (tabla `testi`, ~10.800 filas, 12 idiomas).
 * Backend: /api_master_texts (Testi_Controller, auth hibrida) — GET lista
 * filtrable (gruppo, lingua, chiave, tipo, attiva_sito, search) con orden y
 * paginacion / GET ?id / POST / PUT (id en el body) / DELETE ?id (baja logica).
 * Nunca se lista sin `gruppo` + `lingua`: son demasiadas filas.
 */

export interface B2bText {
  id: number;
  tipo: string;
  gruppo: string | null;
  lingua: string;
  chiave: string;
  label: string | null;
  helpc: string | null;
  commento: string | null;
  attiva_sito: string | null;
}

export interface B2bLanguage {
  code: string;
  name: string;
}

/** Los 12 idiomas del sitio B2B (codigos del ERP, no ISO). */
export const B2B_LANGUAGES: readonly B2bLanguage[] = [
  { code: 'ARB', name: 'العربية' },
  { code: 'CNS', name: '中文' },
  { code: 'DAN', name: 'Dansk' },
  { code: 'ENG', name: 'English' },
  { code: 'FRA', name: 'Français' },
  { code: 'ITA', name: 'Italiano' },
  { code: 'OLA', name: 'Nederlands' },
  { code: 'POR', name: 'Português' },
  { code: 'RUS', name: 'Русский' },
  { code: 'SPA', name: 'Español' },
  { code: 'TED', name: 'Deutsch' },
  { code: 'VTN', name: 'Tiếng Việt' },
];

export const DEFAULT_BASE_LANGUAGE = 'ITA';
export const DEFAULT_TARGET_LANGUAGE = 'ENG';

/** Idiomas elegibles como destino: todos menos el de base. */
export function targetLanguages(base: string): B2bLanguage[] {
  return B2B_LANGUAGES.filter((l) => l.code !== base);
}

/** Si el destino coincide con la base, devuelve el primer idioma distinto. */
export function ensureDistinctTarget(base: string, target: string): string {
  if (target && target !== base) return target;
  return targetLanguages(base)[0]?.code ?? target;
}

/** Fila lado a lado: texto base y texto (editable) del idioma de destino. */
export interface TextPair {
  chiave: string;
  base: B2bText | null;
  target: B2bText | null;
}

/** Un texto cuenta como sin traducir si no existe en destino o esta vacio. */
export function isUntranslated(pair: TextPair): boolean {
  return !pair.target || !(pair.target.label ?? '').trim();
}

/** Empareja por clave los textos de base y destino, ordenados por clave. */
export function pairTexts(baseRows: B2bText[], targetRows: B2bText[]): TextPair[] {
  const targets = new Map(targetRows.map((r) => [r.chiave, r]));
  const seen = new Set<string>();
  const pairs: TextPair[] = [];
  for (const b of baseRows) {
    seen.add(b.chiave);
    pairs.push({ chiave: b.chiave, base: b, target: targets.get(b.chiave) ?? null });
  }
  for (const t of targetRows) {
    if (!seen.has(t.chiave)) pairs.push({ chiave: t.chiave, base: null, target: t });
  }
  return pairs.sort((a, b) => a.chiave.localeCompare(b.chiave));
}

export function filterPairs(pairs: TextPair[], onlyUntranslated: boolean): TextPair[] {
  return onlyUntranslated ? pairs.filter(isUntranslated) : pairs;
}

export interface B2bTextFilters {
  lingua: string;
  gruppo?: string;
  search?: string;
  tipo?: string;
}

export interface B2bTextPayload {
  tipo: string;
  gruppo: string;
  lingua: string;
  chiave: string;
  label: string;
  helpc: string;
  commento: string;
  attiva_sito?: string;
}

const BASE = '/api_master_texts';
export const PAGE_SIZE = 25;
const GROUP_PAGE_SIZE = 200;
const GROUP_MAX_PAGES = 30;

/** Parametros de la consulta de lista (siempre filtrada por idioma y ordenada por clave). */
export function buildListQuery(
  page: number,
  filters: B2bTextFilters,
  perPage = PAGE_SIZE,
): Record<string, string | number> {
  const q: Record<string, string | number> = {
    page,
    limit: perPage,
    lingua: filters.lingua,
    sort: 'chiave',
  };
  if (filters.gruppo) q.gruppo = filters.gruppo;
  if (filters.search) q.search = filters.search;
  if (filters.tipo) q.tipo = filters.tipo;
  return q;
}

/** Cuerpo del POST/PUT para guardar la traduccion de una fila (hereda tipo, grupo, ayuda y comentario). */
export function buildPayload(base: B2bText, label: string, existing: B2bText | null, lingua: string): B2bTextPayload {
  return {
    tipo: existing?.tipo ?? base.tipo ?? 'TX',
    gruppo: existing?.gruppo ?? base.gruppo ?? '',
    lingua,
    chiave: base.chiave,
    label,
    helpc: existing?.helpc ?? base.helpc ?? '',
    commento: existing?.commento ?? base.commento ?? '',
  };
}

interface RawWrite {
  success?: boolean;
  error?: string;
  message?: string;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || raw.message || fallback);
}

export const b2bTextsService = {
  async list(page: number, filters: B2bTextFilters, perPage = PAGE_SIZE): Promise<Paginated<B2bText>> {
    const raw = await http<unknown>(BASE, { query: buildListQuery(page, filters, perPage) });
    return paginated<B2bText>(raw);
  },

  /** Todos los textos de un grupo en un idioma (recorre las paginas; un grupo son pocas centenas de filas). */
  async listGroup(gruppo: string, lingua: string): Promise<B2bText[]> {
    const out: B2bText[] = [];
    for (let page = 1; page <= GROUP_MAX_PAGES; page++) {
      const r = await this.list(page, { lingua, gruppo }, GROUP_PAGE_SIZE);
      out.push(...r.items);
      if (page >= r.pages || r.items.length === 0) break;
    }
    return out;
  },

  async create(payload: B2bTextPayload): Promise<void> {
    assertOk(await http<RawWrite>(BASE, { method: 'POST', body: payload }), 'Create failed');
  },

  async update(id: number, payload: B2bTextPayload): Promise<void> {
    assertOk(await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } }), 'Update failed');
  },

  async remove(id: number): Promise<void> {
    assertOk(await http<RawWrite>(BASE, { method: 'DELETE', query: { id: String(id) } }), 'Delete failed');
  },
};

/** Busqueda local (clave, texto base, texto destino) sobre las filas ya cargadas del grupo. */
export function searchPairs(pairs: TextPair[], term: string): TextPair[] {
  const q = term.trim().toLowerCase();
  if (!q) return pairs;
  const has = (v: string | null | undefined) => (v ?? '').toLowerCase().includes(q);
  return pairs.filter((p) => has(p.chiave) || has(p.base?.label) || has(p.target?.label) || has(p.base?.helpc) || has(p.base?.commento));
}

export function pageSlice<T>(items: T[], page: number, perPage = PAGE_SIZE): T[] {
  return items.slice((page - 1) * perPage, page * perPage);
}
