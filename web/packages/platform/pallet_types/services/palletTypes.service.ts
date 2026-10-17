import { http } from '../../anagrafiche/services/http';

/**
 * Pallet type admin (bancali_tipi). Réplica moderna de la página legacy
 * `bancali.php` (edición inline por AJAX vía `bancali_ajax.php`).
 *
 * Es POR PROVEEDOR — el legacy exige elegir un fornitore antes de listar
 * (dropdown restringido a `tipo IN ('T','P')` o `id=1`/TMWE). Backend
 * confirmado como "changes here directly affect pallet-based rating" —
 * esta tabla alimenta el motor de pricing por palé
 * (model/pricing/Bancale_Type_Model.php), no es un catálogo inerte.
 *
 * Backend: /api_bancali_tipi (Bancali_Tipo_Controller) — CRUD REST completo.
 *   GET  ?id_fornitore=N  (obligatorio)   lista del proveedor
 *   GET  ?id=N                            un registro
 *   POST / PUT / DELETE (soft-delete, stato='O')
 *
 * `internaz`: NZ=Nazionale, IN=Internazionale, AL=Entrambi (ambos usos) —
 * significado confirmado en el legacy (`bancali.php:107`).
 */

export type Internaz = 'NZ' | 'IN' | 'AL';
export type Stato = 'A' | 'O';

export interface PalletType {
  id: number;
  id_fornitore: number;
  liv: number;
  b1: string;
  b2: string;
  h: string;
  p: string;
  nome: string;
  code_type: string;
  internaz: Internaz;
  stato: Stato;
}

export interface PalletTypePayload {
  id_fornitore: number;
  liv: number;
  b1: string;
  b2: string;
  h: string;
  p: string;
  nome: string;
  code_type: string;
  internaz: Internaz;
}

const BASE = '/api_bancali_tipi';

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

export const palletTypesService = {
  async listByFornitore(idFornitore: number): Promise<PalletType[]> {
    const raw = await http<unknown>(BASE, { query: { id_fornitore: idFornitore } });
    return listOf<PalletType>(raw);
  },

  async create(payload: PalletTypePayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: PalletTypePayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
