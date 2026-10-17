import { http } from '../../anagrafiche/services/http';

/**
 * Delegación de carrier aéreo genérica — Fase A-bis del plan de
 * deprecación de `admin_config` (docs/plan-deprecacion-admin-config.md).
 * Tabla DISTINTA de `webcargo_delegation` (ya migrada) — esta cubre otros
 * carriers directos (KLM, Lufthansa, BA, AF), no WebCargo. Un partner
 * (`delegated_partner`) usa la credencial de otro (`credential_partner`)
 * para un carrier+país+entorno dados. Backend:
 * /api_admin_air_carrier_delegation (Air_Carrier_Delegation_Admin_Controller),
 * admin-only (TMWE). Portado 1:1 desde
 * `admin_config/src/services/airCarrierDelegation.service.ts`.
 */

export interface AirCarrierDelegation {
  id: number;
  carrier_code: string;
  delegated_partner: number;
  delegated_partner_name?: string | null;
  credential_partner: number;
  credential_partner_name?: string | null;
  origin_country_iso: string;
  environment: string;
  description?: string | null;
  status?: string;
  created_at?: string | null;
  [k: string]: unknown;
}

export interface AirCarrierDelegationPayload {
  id?: number;
  carrier_code: string;
  delegated_partner: number;
  credential_partner: number;
  origin_country_iso: string;
  environment: string;
  description?: string;
}

export interface AirCarrierDelegationFilters {
  carrier_code?: string;
  origin_country_iso?: string;
}

interface RawListResponse {
  success?: boolean;
  data?: AirCarrierDelegation[];
  total?: number;
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  id?: number;
}

const ENDPOINT = '/api_admin_air_carrier_delegation';

export const airCarrierDelegationService = {
  async list(filters: AirCarrierDelegationFilters = {}): Promise<AirCarrierDelegation[]> {
    const query: Record<string, string> = {};
    if (filters.carrier_code) query.carrier_code = filters.carrier_code;
    if (filters.origin_country_iso) query.origin_country_iso = filters.origin_country_iso;
    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load delegations');
    return Array.isArray(raw?.data) ? raw!.data : [];
  },

  async create(payload: AirCarrierDelegationPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
  },

  async update(payload: AirCarrierDelegationPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'PUT', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },
};
