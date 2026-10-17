import { http } from '../../anagrafiche/services/http';

/**
 * Italian chart-of-accounts admin (piano_conti). Réplica moderna de la
 * página legacy `cod_conti.php` (framework "flashfunz": `forms_nomi`
 * resuelve `progr_name='cod_conti'` → `table_name='piano_conti'`).
 *
 * Verificado en BD (2026-08-15): 7 filas, lista PLANA — no hay
 * jerarquía/parent_id en los datos ni en el legacy (mismo generador de
 * formularios que `studi_settore`, sin lógica de árbol). `detraibilita` /
 * `detraibilitaIVA` son porcentajes de deducibilidad fiscal (costo / IVA)
 * típicos de normativa italiana para gastos de vehículos. Ningún otro
 * módulo referencia esta tabla hoy — el catálogo existe pero no está
 * conectado a ningún flujo de facturación real.
 *
 * Backend: /api_master_chart_of_accounts (Piano_Conti_Controller) — CRUD REST completo.
 *   GET / GET ?id=N / POST / PUT / DELETE (soft-delete, stato='O')
 *
 * admin_only (sesión).
 */

export type Stato = 'A' | 'O';

export interface ChartAccount {
  id: number;
  descr: string;
  codice: string;
  detraibilita: number;
  detraibilitaIVA: number;
  stato: Stato;
}

export interface ChartAccountPayload {
  descr: string;
  codice: string;
  detraibilita: number;
  detraibilitaIVA: number;
}

const BASE = '/api_master_chart_of_accounts';

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

export const chartOfAccountsService = {
  async list(): Promise<ChartAccount[]> {
    const raw = await http<unknown>(BASE);
    return listOf<ChartAccount>(raw);
  },

  async create(payload: ChartAccountPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: ChartAccountPayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
