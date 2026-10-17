import { http } from '../../anagrafiche/services/http';

/**
 * Extracharges / supplements catalogue admin (supplementi). ~146 filas
 * activas usadas directamente por el motor de pricing (courier + cargo).
 *
 * `auto_applied` lo calcula el BACKEND (Supplementi_Controller, a partir de
 * la constante Supplementi_Model::AUTO_APPLIED_IDS) — el propio modelo
 * prohíbe duplicar esa lista en el frontend, así que esta UI solo la
 * consume vía la respuesta del listado, nunca la reconstruye localmente.
 *
 * Backend: /api_master_supplements (Supplementi_Controller) — CRUD REST
 * completo vía Listable_Trait + Abstract_Crud_Controller.
 *   GET (paginado, filtros) / GET ?id=N / POST / PUT / DELETE (soft-delete)
 */

export type Flag = 'S' | 'N';

export interface Extracharge {
  id: number;
  sped_ckbox: Flag;
  gruppo: number;
  orderby: number;
  autosize: Flag;
  fisso: Flag;
  nome: string;
  nome_EN: string;
  iso_paese: string | null;
  courier: Flag;
  cargo: Flag;
  help: string | null;
  help_EN: string | null;
  import: Flag;
  export: Flag;
  blocca: Flag;
  /** Calculado por el backend — ver docblock arriba. */
  auto_applied: boolean;
}

export interface ExtrachargePayload {
  sped_ckbox: Flag;
  gruppo: number;
  orderby: number;
  autosize: Flag;
  fisso: Flag;
  nome: string;
  nome_EN: string;
  iso_paese: string;
  courier: Flag;
  cargo: Flag;
  help: string;
  help_EN: string;
  import: Flag;
  export: Flag;
  blocca: Flag;
}

const BASE = '/api_master_supplements';

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

export const extrachargesService = {
  async list(): Promise<Extracharge[]> {
    // limit alto: el catálogo (~146 filas activas) se gestiona completo,
    // no paginado — mismo criterio que el picker (Supplementi_Controller
    // ya sube el límite por defecto a 500 para este mismo motivo.
    const raw = await http<unknown>(BASE, { query: { limit: 500 } });
    return listOf<Extracharge>(raw);
  },

  async create(payload: ExtrachargePayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Create failed');
  },

  async update(id: number, payload: ExtrachargePayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { id, ...payload } });
    assertOk(raw, 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { id } });
    assertOk(raw, 'Delete failed');
  },
};
