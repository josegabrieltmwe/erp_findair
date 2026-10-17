import { http } from '../../anagrafiche/services/http';
import { paginated, unwrap } from '../../anagrafiche/services/normalizers';

/**
 * Supplementi (surcharge/supplement catalog, table `supplementi`).
 *
 * Backend:
 *   - GET /api_master_supplements            list (paginated, default 500/page)
 *   - GET /api_master_supplements?id=N       single record
 *
 * Served to the SPA through the HYBRID-auth wrapper
 * `Web_Supplementi_Controller` (same route, session-callable).
 *
 * Real columns (see model/master_data/Supplementi_Model.php):
 *   id, nome, nome_EN, gruppo, iso_paese, courier, cargo, stato ('A'|'O').
 * `nome` is the descriptive (Italian) label; `nome_EN` is the English one.
 */
export interface SupplementLite {
  id: number;
  nome: string;
  nome_EN?: string;
  gruppo?: number | string;
  iso_paese?: string;
  courier?: string;
  cargo?: string;
  [k: string]: unknown;
}

const ENDPOINT = '/api_master_supplements';

export const supplementiService = {
  /** Search the catalog by name (backend searchable fields: nome, nome_EN). */
  async search(query: string, perPage = 25): Promise<SupplementLite[]> {
    const q = query.trim();
    const params: Record<string, string | number> = { per_page: perPage };
    if (q) params.search = q;
    const raw = await http<unknown>(ENDPOINT, { query: params });
    if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
      const arr = unwrap<SupplementLite[]>(raw);
      return Array.isArray(arr) ? arr : [];
    }
    const page = paginated<SupplementLite>(raw, 'data');
    return page.items;
  },

  async getById(id: number): Promise<SupplementLite | null> {
    if (!id) return null;
    try {
      const raw = await http<unknown>(ENDPOINT, { query: { id } });
      const r = unwrap<SupplementLite | SupplementLite[]>(raw);
      if (Array.isArray(r)) return r[0] ?? null;
      return r ?? null;
    } catch {
      return null;
    }
  },
};
