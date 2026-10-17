import { http } from '../../anagrafiche/services/http';

/**
 * Credenciales e-AWB/CargoStart — Fase A-bis del plan de deprecación de
 * `admin_config` (docs/plan-deprecacion-admin-config.md). Distinto de
 * KLM/WebCargo/fornitori_accnt: es la credencial de la pasarela e-AWB
 * (FWB/FHL), por país + partner opcional (null = compartida). Backend:
 * /api_admin_ewb_credentials (Ewb_Credentials_Admin_Controller), admin-only
 * (TMWE). Portado 1:1 desde
 * `admin_config/src/services/ewbCredentials.service.ts`.
 */

export interface EwbCredential {
  id: number;
  country_iso: string;
  partner_id: number | null;
  partner_name?: string | null;
  auth_header?: string | null;
  auth_prefix?: string | null;
  description?: string | null;
  status?: string;
  has_key?: boolean;
  has_secret?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  [k: string]: unknown;
}

export interface EwbCredentialPayload {
  id?: number;
  country_iso: string;
  partner_id?: number | null;
  /** Solo escritura. Vacío en update = deja la key guardada sin cambios. */
  api_key?: string;
  /** Solo escritura. Vacío en update = deja el secret guardado sin cambios. */
  api_secret?: string;
  auth_header?: string;
  auth_prefix?: string;
  description?: string;
}

interface RawListResponse {
  success?: boolean;
  data?: EwbCredential[];
  total?: number;
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  id?: number;
  data?: EwbCredential;
}

const ENDPOINT = '/api_admin_ewb_credentials';

export const ewbCredentialsService = {
  async list(countryIso?: string): Promise<EwbCredential[]> {
    const query: Record<string, string> = {};
    if (countryIso) query.country_iso = countryIso;
    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load e-AWB credentials');
    return Array.isArray(raw?.data) ? raw!.data : [];
  },

  async create(payload: EwbCredentialPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
  },

  async update(payload: EwbCredentialPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'PUT', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },
};
