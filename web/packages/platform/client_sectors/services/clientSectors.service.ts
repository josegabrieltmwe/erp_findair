import { http } from '../../anagrafiche/services/http';

/**
 * Commercial field/sector admin (settori_clienti). Réplica moderna de la
 * página legacy `cod_stmerc.php`. Sub-categoría comercial del cliente,
 * FK a `studi_settore` (L03, `fiscal_settings`) vía `id_studi_settore`.
 * Sin consumidores modernos confirmados (backend nuevo, tabla sin uso
 * fuera del legacy) — catálogo de bajo riesgo, 5 filas de referencia.
 *
 * Backend: /api_master_client_sectors (Settori_Clienti_Controller,
 * NUEVO — sigue exactamente el patrón de Studi_Settore_Controller) — CRUD
 * REST completo.
 */

export type Stato = 'A' | 'O';

export interface ClientSector {
  id: number;
  descr: string;
  id_studi_settore: number;
  stato: Stato;
}

export interface ClientSectorPayload {
  descr: string;
  id_studi_settore: number;
}

const BASE = '/api_master_client_sectors';

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

export const clientSectorsService = {
  async list(): Promise<ClientSector[]> {
    const raw = await http<unknown>(BASE);
    return listOf<ClientSector>(raw);
  },

  async create(payload: ClientSectorPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: ClientSectorPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
