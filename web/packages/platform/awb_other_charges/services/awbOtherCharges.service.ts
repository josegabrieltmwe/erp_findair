import { http } from '../../anagrafiche/services/http';

/**
 * Catálogo de descripciones de "otros cargos" AWB (`awb_other_charge`).
 * Réplica moderna de `awb_othercrg.php` (Fase 7/L24).
 *
 * ⚠️ Backend NUEVO — el modelo previo `model/cargo/Awb_Other_Charge.php`
 * apuntaba a una tabla (`cargo_awb_oth_charges`) que nunca existió, era
 * código muerto sin ningún consumidor. Este servicio usa el modelo/
 * controller nuevos, escritos contra el esquema real (12 filas, solo
 * `id`+`descr`+`stato`). Distinto de `cargo_charges` (L23, `cargo_voci`)
 * — dominios independientes pese a que el plan original los agrupaba.
 *
 * Backend: /api_master_awb_other_charges (Awb_Other_Charge_Controller) —
 * CRUD REST completo.
 */

export interface AwbOtherCharge {
  id: number;
  descr: string;
  stato: 'A' | 'O';
}

export interface AwbOtherChargePayload {
  descr: string;
}

const BASE = '/api_master_awb_other_charges';

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

export const awbOtherChargesService = {
  async list(): Promise<AwbOtherCharge[]> {
    const raw = await http<unknown>(BASE);
    return listOf<AwbOtherCharge>(raw);
  },

  async create(payload: AwbOtherChargePayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: AwbOtherChargePayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
