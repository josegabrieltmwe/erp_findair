import { http } from '../../anagrafiche/services/http';

/**
 * B2B task/case type admin (crm_tipi). Réplica moderna de `crm_tipi.php`.
 * Catálogo consumido como selector en el formulario de pratica CRM
 * (`modules/crm/stores/crm.store.ts::listTypes()`), no editable desde ahí.
 *
 * `tipo_voce`: P=Público/portal (motivo de contacto del cliente),
 * I=Interno (tarea operativa), T=reservado por el enum pero sin uso
 * confirmado en datos actuales.
 *
 * Backend: /api_crm_types (Web_Crm_Type_Controller, auth híbrida
 * sesión+Bearer ya resuelta a nivel de ruta) — CRUD REST completo.
 */

export type TipoVoce = 'P' | 'I' | 'T';

export interface CrmType {
  id: number;
  descr: string;
  descrEN: string | null;
  tipo_voce: TipoVoce;
  stato: 'A' | 'O';
}

export interface CrmTypePayload {
  descr: string;
  descrEN: string;
  tipo_voce: TipoVoce;
}

const BASE = '/api_crm_types';

interface SingleEnvelope<T> {
  success?: boolean;
  data: T;
}

function listOf<T>(raw: unknown): T[] {
  const r = raw as { data?: T[] } | null;
  return Array.isArray(r?.data) ? (r!.data as T[]) : [];
}

export const crmTypesService = {
  async list(): Promise<CrmType[]> {
    const raw = await http<unknown>(BASE);
    return listOf<CrmType>(raw);
  },

  async create(payload: CrmTypePayload): Promise<void> {
    await http<SingleEnvelope<CrmType>>(BASE, { method: 'POST', body: payload });
  },

  async update(id: number, payload: CrmTypePayload): Promise<void> {
    await http<SingleEnvelope<CrmType>>(BASE, { method: 'PUT', body: { id, ...payload } });
  },

  async remove(id: number): Promise<void> {
    await http(BASE, { method: 'DELETE', query: { id: String(id) } });
  },
};
