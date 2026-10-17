import { http } from '../../anagrafiche/services/http';

/**
 * Italian fiscal settings admin (studi_settore). Réplica moderna de la
 * página legacy `cod_stsett.php` (framework "flashfunz": `forms_nomi`
 * resuelve `progr_name='cod_stsett'` → `table_name='studi_settore'`).
 *
 * Catálogo pequeño (4 filas de referencia: Informatica, Edilizia, Editoria,
 * Commercio) usado por L02 (Commercial Fields / settori_clienti, vía
 * `id_studi_settore`) — no confundir con `cod_stmerc`, que es un dominio
 * distinto (categorías de mercancía de cargo).
 *
 * Backend: /api_master_studi_settore (Studi_Settore_Controller) — CRUD REST completo.
 *   GET                 lista (activos e inactivos, filtrar por `stato` en cliente)
 *   GET  ?id=N           un registro
 *   POST                crear   { descr, codice }
 *   PUT                 actualizar (id en body)
 *   DELETE ?id=N        soft-delete (stato='O')
 *
 * admin_only (sesión).
 */

export type Stato = 'A' | 'O';

export interface FiscalSetting {
  id: number;
  descr: string;
  codice: string;
  stato: Stato;
}

export interface FiscalSettingPayload {
  descr: string;
  codice: string;
}

const BASE = '/api_master_studi_settore';

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

function listOf<T>(raw: unknown): T[] {
  const r = raw as { data?: T[] } | null;
  return Array.isArray(r?.data) ? (r!.data as T[]) : [];
}

export const fiscalSettingsService = {
  async list(): Promise<FiscalSetting[]> {
    const raw = await http<unknown>(BASE);
    return listOf<FiscalSetting>(raw);
  },

  async create(payload: FiscalSettingPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: FiscalSettingPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
