import { http } from '../../anagrafiche/services/http';

/**
 * Pallet MPL (metro bancale lineare) admin (bancali_mpl). Réplica moderna de
 * la página legacy `bancali_mpl.php` — "Gestione scaglioni dei bancali a
 * mpl associati ai listini" (gestión de escalones de palé por metro lineal).
 *
 * Es por proveedor, igual que L09 (bancali_tipi) — pero es una tabla
 * PARALELA, sin FK entre ambas (verificado en el esquema: sin columna que
 * relacione bancali_mpl con bancali_tipi). Depende de L09 solo en el sentido
 * de que comparten dominio/proveedor, no en estructura de datos.
 *
 * Backend: /api_bancali_mpl (Bancali_Mpl_Controller) — CRUD REST completo.
 *   GET  ?id_fornitore=N  (obligatorio) / GET ?id=N / POST / PUT / DELETE
 */

export type Internaz = 'NZ' | 'IN' | 'AL';
export type Stato = 'A' | 'O';

export interface PalletMpl {
  id: number;
  id_fornitore: number;
  mpl: number;
  qta: number;
  p: number;
  nome: string;
  code_type: string;
  internaz: Internaz;
  stato: Stato;
}

export interface PalletMplPayload {
  id_fornitore: number;
  mpl: number;
  qta: number;
  p: number;
  nome: string;
  code_type: string;
  internaz: Internaz;
}

const BASE = '/api_bancali_mpl';

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

export const palletMplService = {
  async listByFornitore(idFornitore: number): Promise<PalletMpl[]> {
    const raw = await http<unknown>(BASE, { query: { id_fornitore: idFornitore } });
    return listOf<PalletMpl>(raw);
  },

  async create(payload: PalletMplPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: PalletMplPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
