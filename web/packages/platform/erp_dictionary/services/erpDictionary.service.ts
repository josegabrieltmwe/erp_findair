import { http } from '../../anagrafiche/services/http';
import { paginated } from '../../anagrafiche/services/normalizers';
import type { Paginated } from '../../anagrafiche/services/api.types';

/**
 * ⚠️ Editor del diccionario de traducciones del ERP (`testi_erp`, ~3.228
 * filas activas, ITA/ENG). Réplica moderna de la parte "Translation ERP" de
 * `home_box_8.php`. Alimenta en vivo:
 *   - Renderizado de páginas HTML legacy vía `Testi_Erp::get_erp_labels_in()`
 *     ($GLOBALS['llberp']), consumido por `Abstract_Controller_Html`,
 *     `List_Spedy_Controller`, etc.
 *   - El diccionario de solo lectura del SPA moderno
 *     (`I18n_Dictionary_Controller` / `/api_i18n_dictionary`).
 *
 * Backend nuevo (Fase 6/L27): `Testi_Erp_Controller`/`Web_Testi_Erp_Controller`
 * — hasta ahora la única vía de escritura era `Testi_Erp::upsert_label()`,
 * documentada explícitamente como "solo desde scripts CLI, no exponer al
 * runtime web". Se acepta el riesgo con advertencia visible (mismo criterio
 * que L26/L08/L18).
 *
 * Nunca se lista sin filtro. Requiere lingua + (gruppo o búsqueda).
 *
 * Backend: /api_master_erp_texts (Testi_Erp_Controller) — CRUD REST,
 * paginado (`page`/`limit`), filtrable por `gruppo`/`lingua`/`chiave`/`tipo`,
 * buscable por `chiave`/`label`/`helpc`/`commento`.
 */

export type ErpDictTipo = 'TX' | 'JS' | 'MSF' | 'MSB' | 'DAYF' | 'DAYB';

export interface ErpDictionaryEntry {
  id: number;
  tipo: ErpDictTipo;
  gruppo: string | null;
  lingua: string;
  chiave: string;
  label: string | null;
  label_noapc: 'S' | 'N';
  label_br: 'NO' | 'NL' | 'BR';
  helpc: string | null;
  help_noapc: 'S' | 'N';
  help_br: 'NO' | 'NL' | 'BR';
  commento: string | null;
  stato: 'A' | 'O';
}

export interface ErpDictionaryPayload {
  tipo: ErpDictTipo;
  gruppo: string;
  lingua: string;
  chiave: string;
  label: string;
  label_noapc: 'S' | 'N';
  label_br: 'NO' | 'NL' | 'BR';
  helpc: string;
  help_noapc: 'S' | 'N';
  help_br: 'NO' | 'NL' | 'BR';
  commento: string;
}

export interface ErpDictionaryFilters {
  lingua: string;
  gruppo?: string;
  search?: string;
  tipo?: ErpDictTipo;
}

const BASE = '/api_master_erp_texts';

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

export const erpDictionaryService = {
  async list(page: number, filters: ErpDictionaryFilters, perPage = 30): Promise<Paginated<ErpDictionaryEntry>> {
    const query: Record<string, string | number> = { page, limit: perPage, lingua: filters.lingua };
    if (filters.gruppo) query.gruppo = filters.gruppo;
    if (filters.search) query.search = filters.search;
    if (filters.tipo) query.tipo = filters.tipo;
    const raw = await http<unknown>(BASE, { query });
    return paginated<ErpDictionaryEntry>(raw);
  },

  async create(payload: ErpDictionaryPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: ErpDictionaryPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
