import { http } from '../../anagrafiche/services/http';

/**
 * Credenciales de courier genérico (DHL, DPD, UPS, FedEx, TNT, TACT, Agora
 * — KLM/WebCargo tienen su propio sistema, ver air_carrier_credentials/
 * webcargo_key). Backend: /api_admin_service_credentials
 * (Service_Credential_Admin_Controller), admin-only (TMWE).
 *
 * Los secretos (auth_password, oauth_client_secret, api_key) nunca llegan en
 * claro — el backend los enmascara (`****1234`); enviar vacío en update
 * significa "no cambiar".
 */

export const SUPPORTED_COURIERS = ['dhl', 'dpd', 'ups', 'fedex', 'tnt', 'klm', 'webcargo', 'agora', 'tact'] as const;
export type SupportedCourier = (typeof SUPPORTED_COURIERS)[number];

export interface ServiceCredential {
  id: number;
  courier_code: string;
  account_number?: string | null;
  /** Dueño de la credencial; 0/null = compartida "de la casa". */
  id_partner?: number | null;
  environment: 'production' | 'sandbox';
  auth_username?: string | null;
  auth_password?: string | null;
  oauth_client_id?: string | null;
  oauth_client_secret?: string | null;
  api_key?: string | null;
  customer_code?: string | null;
  country_iso?: string | null;
  postal_code?: string | null;
  metric_system?: string | null;
  currency?: string | null;
  language?: string | null;
  description?: string | null;
  stato?: string;
  [k: string]: unknown;
}

export interface ServiceCredentialFilters {
  courier_code?: string;
  environment?: string;
  /** Filtra a las credenciales propias de ese partner (tab en la ficha de anagrafica). */
  id_partner?: number;
}

export interface ServiceCredentialPayload {
  id?: number;
  courier_code: string;
  account_number?: string;
  id_partner?: number | null;
  environment: string;
  auth_username?: string;
  auth_password?: string;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  api_key?: string;
  customer_code?: string;
  country_iso?: string;
  postal_code?: string;
  metric_system?: string;
  currency?: string;
  language?: string;
  description?: string;
}

interface RawListResponse {
  success?: boolean;
  data?: ServiceCredential[];
  total?: number;
  supported_couriers?: string[];
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  id?: number;
  data?: ServiceCredential;
}

const ENDPOINT = '/api_admin_service_credentials';

export const serviceCredentialsService = {
  async list(filters: ServiceCredentialFilters = {}): Promise<ServiceCredential[]> {
    const query: Record<string, string> = {};
    if (filters.courier_code) query.courier_code = filters.courier_code;
    if (filters.environment) query.environment = filters.environment;
    if (filters.id_partner) query.id_partner = String(filters.id_partner);
    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load credentials');
    return Array.isArray(raw?.data) ? raw!.data : [];
  },

  async create(payload: ServiceCredentialPayload): Promise<ServiceCredential | null> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
    return raw?.data ?? null;
  },

  async update(payload: ServiceCredentialPayload): Promise<ServiceCredential | null> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'PUT', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
    return raw?.data ?? null;
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },
};
