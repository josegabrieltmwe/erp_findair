import { http } from '../../anagrafiche/services/http';

export interface AirCarrierCredential {
  id: number;
  carrier_code: string;
  partner_id: number | null;
  partner_name?: string | null;
  country_iso: string;
  environment: string;
  /** KLM issues a separate key per product: sales | tracking | opendata. */
  api_product?: string;
  oauth_key?: string | null;
  customer_urn?: string | null;
  consumer_id?: string | null;
  base_url?: string | null;
  principale?: string;
  description?: string | null;
  status?: string;
  has_secret?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  [k: string]: unknown;
}

export interface AirCarrierCredentialPayload {
  id?: number;
  carrier_code: string;
  partner_id?: number | null;
  country_iso: string;
  environment: string;
  api_product?: string;
  oauth_key: string;
  /** Write-only. Empty on update = leave the stored secret unchanged. */
  oauth_secret?: string;
  customer_urn?: string;
  consumer_id?: string;
  base_url?: string;
  principale?: string;
  description?: string;
}

export interface AirCarrierCredentialFilters {
  carrier_code?: string;
  country_iso?: string;
  environment?: string;
  api_product?: string;
  /** Filtra a las credenciales propias de ese partner (tab en la ficha de anagrafica). */
  partner_id?: number;
}

interface RawListResponse {
  success?: boolean;
  data?: AirCarrierCredential[];
  total?: number;
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  id?: number;
  data?: AirCarrierCredential;
}

const ENDPOINT = '/api_admin_air_carrier_credentials';

export const airCarrierCredentialsService = {
  async list(filters: AirCarrierCredentialFilters = {}): Promise<AirCarrierCredential[]> {
    const query: Record<string, string> = {};
    if (filters.carrier_code) query.carrier_code = filters.carrier_code;
    if (filters.country_iso) query.country_iso = filters.country_iso;
    if (filters.environment) query.environment = filters.environment;
    if (filters.api_product) query.api_product = filters.api_product;
    if (filters.partner_id) query.partner_id = String(filters.partner_id);
    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load air carrier credentials');
    return Array.isArray(raw?.data) ? raw!.data : [];
  },

  async create(payload: AirCarrierCredentialPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
  },

  async update(payload: AirCarrierCredentialPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'PUT', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },
};
