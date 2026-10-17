import { http } from '../../anagrafiche/services/http';

export interface PartnerCarrierEnvironment {
  id: number;
  partner_id: number;
  partner_name?: string | null;
  carrier_code: string;
  environment: string;
  status?: string;
  updated_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PartnerCarrierEnvironmentPayload {
  id?: number;
  partner_id: number;
  carrier_code: string;
  environment: string;
}

interface RawListResponse {
  success?: boolean;
  data?: PartnerCarrierEnvironment[];
  total?: number;
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  id?: number;
  data?: PartnerCarrierEnvironment;
}

const ENDPOINT = '/api_admin_partner_carrier_environment';

export const partnerCarrierEnvironmentService = {
  async list(filters: { partner_id?: number; carrier_code?: string } = {}): Promise<PartnerCarrierEnvironment[]> {
    const query: Record<string, string> = {};
    if (filters.partner_id) query.partner_id = String(filters.partner_id);
    if (filters.carrier_code) query.carrier_code = filters.carrier_code;
    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load partner carrier environment');
    return Array.isArray(raw?.data) ? raw!.data : [];
  },

  async create(payload: PartnerCarrierEnvironmentPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
  },

  async update(payload: PartnerCarrierEnvironmentPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'PUT', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },
};
