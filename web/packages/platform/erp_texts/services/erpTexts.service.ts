import { http } from '../../anagrafiche/services/http';
import { paginated } from '../../anagrafiche/services/normalizers';
import type { Paginated } from '../../anagrafiche/services/api.types';

/**
 * ⚠️ Editor de textos configurables del ERP legacy (`testi`, ~10.786 filas
 * activas, 10 idiomas). Réplica moderna de `testi.php`. Alimenta en vivo el
 * renderizado de texto de páginas legacy vía `Testi_Model`/consumidores
 * directos — NO es un catálogo aislado: una fila mal editada puede romper
 * la UI de una pantalla legacy en el idioma afectado. Distinto de
 * `testi_erp` (L27, `erp_dictionary`), que alimenta las plantillas HTML
 * (`Abstract_Controller_Html`, `List_Spedy_Controller`) vía `$llberp`.
 *
 * Nunca se lista sin filtro: 10k+ filas. Requiere `lingua` + (`gruppo` o
 * `search`) antes de listar.
 *
 * Backend: /api_master_texts (Testi_Controller) — CRUD REST completo,
 * paginado (`page`/`limit`), filtrable por `gruppo`/`lingua`/`chiave`/
 * `tipo`/`attiva_sito`, buscable por `chiave`/`label`/`helpc`/`commento`.
 */

export type TestoTipo = 'TX' | 'JS' | 'LNG' | 'MSF' | 'MSB';

export interface ErpText {
  id: number;
  tipo: TestoTipo;
  gruppo: string | null;
  lingua: string;
  chiave: string;
  label: string | null;
  label_noapc: string | null;
  label_br: string | null;
  helpc: string | null;
  help_noapc: string | null;
  help_br: string | null;
  commento: string | null;
  attiva_sito: string | null;
  stato: 'A' | 'O';
}

export interface ErpTextPayload {
  tipo: TestoTipo;
  gruppo: string;
  lingua: string;
  chiave: string;
  label: string;
  label_noapc: string;
  label_br: string;
  helpc: string;
  help_noapc: string;
  help_br: string;
  commento: string;
  attiva_sito: string;
}

export interface ErpTextFilters {
  lingua: string;
  gruppo?: string;
  search?: string;
  tipo?: TestoTipo;
}

const BASE = '/api_master_texts';

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

export const erpTextsService = {
  async list(page: number, filters: ErpTextFilters, perPage = 30): Promise<Paginated<ErpText>> {
    const query: Record<string, string | number> = { page, limit: perPage, lingua: filters.lingua };
    if (filters.gruppo) query.gruppo = filters.gruppo;
    if (filters.search) query.search = filters.search;
    if (filters.tipo) query.tipo = filters.tipo;
    const raw = await http<unknown>(BASE, { query });
    return paginated<ErpText>(raw);
  },

  async create(payload: ErpTextPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: ErpTextPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
