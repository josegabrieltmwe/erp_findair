import { http } from '../../anagrafiche/services/http';

/**
 * Cargo terminals admin (cargo_terminals + cargo_terminals_addr).
 * Réplica modern de la pantalla legacy terminals_list.php.
 *
 * Backend:
 *   - /api_terminals_admin    (Web_Terminal_Admin_Controller) — list/detail/CRUD
 *   - /api_terminals_address  (Web_Terminal_Address_Controller) — direcciones C/T
 *
 * admin_only (sesión). Audit por-campo en log_modifiche lo hace el backend.
 */

export type Flag = 'S' | 'N';

export interface Terminal {
  id: number;
  sigla: string;
  tipo: 'A' | 'P';
  iso_paese: string | null;
  citta: string | null;
  nome: string | null;
  nome_mawb: string | null;
  gruppo: string | null;
  principali: Flag;
  terminal_presa: Flag;
  local: Flag;
  suppl_navetta: Flag;
  suppl_navetta_dst: Flag;
  stato: 'A' | 'O';
  has_addr_c?: number | boolean;
  has_addr_t?: number | boolean;
  has_geo?: number | boolean;
  [k: string]: unknown;
}

export interface TerminalAddress {
  nome: string;
  address: string;
  cap: string;
  citta: string;
  prov: string;
  iso_paese: string;
  tel: string;
}

export interface TerminalFilters {
  sigla?: string;
  iso?: string;
  tipo?: '' | 'A' | 'P';
  citta?: string;
  gruppo?: '' | 'S' | 'N';
  stato?: 'A' | 'O' | '*';
  terminal_presa?: '' | 'S' | 'N';
  local?: '' | 'S' | 'N';
  principali?: '' | 'S' | 'N';
}

export interface TerminalListResult {
  rows: Terminal[];
  total: number;
  page: number;
  per_page: number;
}

export interface TerminalCountry {
  ISO2: string;
  nome: string;
  nomeEN: string;
}

export interface TerminalCreatePayload {
  sigla: string;
  tipo?: 'A' | 'P';
  iso_paese?: string;
  citta?: string;
  nome?: string;
  nome_mawb?: string;
  gruppo?: string;
  principali?: Flag;
  terminal_presa?: Flag;
  local?: Flag;
  suppl_navetta?: Flag;
  suppl_navetta_dst?: Flag;
}

const ADMIN = '/api_terminals_admin';
const ADDRESS = '/api_terminals_address';
const GEO = '/api_terminal_geocode';

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function dataOf<T>(raw: { data?: T } | undefined): T | undefined {
  return raw?.data;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

export const terminalsService = {
  async list(page: number, filters: TerminalFilters = {}, perPage = 100): Promise<TerminalListResult> {
    const query: Record<string, string | number> = { op: 'list', page, per_page: perPage };
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== '') query[k] = v as string;
    }
    const raw = await http<{ data?: TerminalListResult }>(ADMIN, { query });
    return (
      dataOf<TerminalListResult>(raw) ?? { rows: [], total: 0, page, per_page: perPage }
    );
  },

  /** Países (ISO2 + nombre) que tienen terminales — para el filtro con bandera. */
  async listCountries(includeDeleted = false): Promise<TerminalCountry[]> {
    const raw = await http<{ data?: { countries?: TerminalCountry[] } }>(ADMIN, {
      query: { op: 'countries', stato: includeDeleted ? '*' : 'A' },
    });
    return raw?.data?.countries ?? [];
  },

  async detail(id: number): Promise<{
    terminal: Terminal;
    address_c: TerminalAddress | null;
    address_t: TerminalAddress | null;
  }> {
    const raw = await http<{
      data?: { terminal: Terminal; address_c: TerminalAddress | null; address_t: TerminalAddress | null };
    }>(ADMIN, { query: { op: 'detail', id } });
    const d = raw?.data;
    if (!d) throw new Error('Terminal non trovato');
    return d;
  },

  async create(payload: TerminalCreatePayload): Promise<number> {
    const raw = await http<{ success?: boolean; error?: string; data?: { id: number } }>(ADMIN, {
      method: 'POST',
      body: payload,
    });
    assertOk(raw, 'Creazione fallita');
    return raw?.data?.id ?? 0;
  },

  /** Edición inline de un solo campo (texto o flag). */
  async updateField(id: number, field: string, value: string): Promise<string> {
    const raw = await http<{ success?: boolean; error?: string; data?: { value: string } }>(ADMIN, {
      method: 'PATCH',
      body: { id, field, value },
    });
    assertOk(raw, 'Aggiornamento fallito');
    return raw?.data?.value ?? value;
  },

  /** Edición completa de un terminal. */
  async update(id: number, payload: Partial<TerminalCreatePayload>): Promise<void> {
    const raw = await http<RawWrite>(ADMIN, { method: 'PATCH', body: { id, ...payload } });
    assertOk(raw, 'Aggiornamento fallito');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(ADMIN, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Eliminazione fallita');
  },

  // ── Direcciones C/T ──
  async getAddress(id: number, quale: 'C' | 'T'): Promise<TerminalAddress | null> {
    const raw = await http<{ data?: { address: TerminalAddress | null } }>(ADDRESS, {
      query: { id, quale },
    });
    return raw?.data?.address ?? null;
  },

  async saveAddress(id: number, quale: 'C' | 'T', addr: TerminalAddress): Promise<string> {
    const raw = await http<{ success?: boolean; error?: string; data?: { esito: string } }>(ADDRESS, {
      method: 'POST',
      body: { id, quale, ...addr },
    });
    assertOk(raw, 'Salvataggio indirizzo fallito');
    return raw?.data?.esito ?? 'OK';
  },

  // ── Geo (WS-5) ──
  async geocode(id: number): Promise<{ latitude: number; longitude: number } | null> {
    const raw = await http<{
      success?: boolean;
      error?: string;
      data?: { latitude: number; longitude: number };
    }>(GEO, { method: 'POST', body: { id } });
    assertOk(raw, 'Geocodifica fallita');
    return raw?.data ?? null;
  },
};
