import { http } from '../../anagrafiche/services/http';

/**
 * Carrier/country blocks admin (blocco_corrieri). Réplica moderna de la
 * página legacy `corrieri_blocchi.php`. Bloquea el uso de un carrier
 * (courier/aerolínea) para un partner, opcionalmente restringido a ciertos
 * países (`solo_paesi`, lista de ISO separados por espacio) y/o rango de
 * fechas (`solo_dal`/`solo_al`).
 *
 * Tenancy: TMWE ve y edita todos los bloqueos; otros partners solo los
 * suyos (`id_anagr_titolare` forzado por el backend, no editable por
 * partners no-TMWE). El lado de LECTURA que consume el motor de pricing
 * vive en Carrier_Eligibility_Model — este servicio es solo admin/escritura.
 *
 * Backend: /api_blocco_corrieri (Blocco_Corrieri_Controller) — CRUD REST
 * completo con auditoría de campos (Log_Modifiche).
 */

export type Flag = 'S' | 'N';

export interface CarrierBlock {
  id: number;
  id_anagr_titolare: number;
  id_corriere: number;
  tmwe_all: Flag;
  solo_paesi: string | null;
  solo_dal: string | null;
  solo_al: string | null;
}

export interface CarrierBlockPayload {
  id_corriere: number;
  tmwe_all: Flag;
  solo_paesi: string;
  solo_dal: string | null;
  solo_al: string | null;
}

const BASE = '/api_blocco_corrieri';

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

export const carrierBlocksService = {
  async list(): Promise<CarrierBlock[]> {
    const raw = await http<unknown>(BASE);
    return listOf<CarrierBlock>(raw);
  },

  async create(payload: CarrierBlockPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: CarrierBlockPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
