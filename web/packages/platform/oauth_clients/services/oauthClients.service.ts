import { http } from '../../anagrafiche/services/http';

/**
 * OAuth clients (`oauth_client`) — Fase A1 del plan de deprecación de
 * `admin_config`. Backend: /api_admin_external_clients (listado/detalle/
 * update/disable), /api_admin_external_client (provisión, genera secret).
 * Todos admin-only (TMWE). Portado desde
 * `admin_config/src/services/oauthClients.service.ts`. Los scopes sueltos por
 * client (/api_admin_client_scopes) quedaron obsoletos: el permiso del client
 * viene SOLO de su rol OAuth (`role_id`).
 */

export interface OAuthClient {
  id: number;
  client_id: string;
  client_name: string;
  company_name?: string | null;
  contact_email?: string | null;
  description?: string | null;
  /**
   * `internal` para tokens propios del ERP; `external` para integraciones
   * B2B. Nota: clients previos a la migración quedan `internal` aunque
   * funcionalmente sean externos — Findair (id=4) es el ejemplo canónico.
   */
  client_type?: 'internal' | 'external' | string | null;
  tier?: string | null;
  status?: 'active' | 'disabled' | string;
  stato?: string;
  user_id?: number | null;
  role_id?: number | null;
  role_name?: string | null;
  scopes?: string[];
  allowed_origins?: string[] | null;
  allowed_ips?: string[] | null;
  allowed_endpoints?: string[] | null;
  /** Último uso del client (`oauth_client.last_activity_at`); `null` = nunca. */
  last_activity?: string | null;
  created_at?: string | null;
  disabled_reason?: string | null;
  [k: string]: unknown;
}

export type OAuthClientLite = OAuthClient;

export interface ProvisionPayload {
  user_id: number;
  client_name: string;
  company_name: string;
  contact_email?: string;
  scopes?: string[];
  tier?: string;
  /** `oauth_role.id` a asignar al client nuevo. Persistido en `oauth_client.role_id`. */
  role_id?: number | null;
}

export interface ProvisionResult {
  client_id: string;
  client_secret: string;
  role_id?: number | null;
  [k: string]: unknown;
}

export interface UpdateClientPayload {
  client_name?: string;
  company_name?: string;
  contact_email?: string;
  tier?: string;
  role_id?: number | null;
  allowed_origins?: string[] | null;
  allowed_ips?: string[] | null;
  allowed_endpoints?: string[] | null;
}

interface RawListResponse {
  clients?: OAuthClient[];
  count?: number;
  error?: string;
}

interface RawDetailResponse {
  client?: OAuthClient;
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  action?: string;
  client_id?: string | number;
  [k: string]: unknown;
}

const LIST_ENDPOINT = '/api_admin_external_clients';
const CREATE_ENDPOINT = '/api_admin_external_client';

export const oauthClientsService = {
  async list(filters: { status?: string; tier?: string; user_id?: number } = {}): Promise<OAuthClient[]> {
    const query: Record<string, string | number> = {};
    if (filters.status) query.status = filters.status;
    if (filters.tier) query.tier = filters.tier;
    if (filters.user_id) query.user_id = filters.user_id;
    const raw = await http<RawListResponse>(LIST_ENDPOINT, { query });
    if (raw?.error) throw new Error(raw.error);
    return Array.isArray(raw?.clients) ? raw!.clients : [];
  },

  async search(query: string, perPage = 25): Promise<OAuthClient[]> {
    const q = query.trim();
    const params: Record<string, string | number> = { per_page: perPage };
    if (q) params.search = q;
    const raw = await http<RawListResponse>(LIST_ENDPOINT, { query: params });
    if (raw?.error) throw new Error(raw.error);
    return Array.isArray(raw?.clients) ? raw!.clients : [];
  },

  async getById(id: number): Promise<OAuthClient | null> {
    if (!id) return null;
    try {
      const raw = await http<RawDetailResponse>(LIST_ENDPOINT, { query: { id } });
      if (raw?.error) return null;
      return raw?.client ?? null;
    } catch {
      return null;
    }
  },

  async provision(payload: ProvisionPayload): Promise<ProvisionResult> {
    const raw = await http<RawWriteResponse>(CREATE_ENDPOINT, { method: 'POST', body: payload });
    if (raw?.error) throw new Error(raw.error);
    return raw as unknown as ProvisionResult;
  },

  async update(id: number, payload: UpdateClientPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(LIST_ENDPOINT, {
      method: 'PUT',
      query: { id },
      body: payload,
    });
    if (raw?.error) throw new Error(raw.error);
  },

  async disable(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(LIST_ENDPOINT, {
      method: 'DELETE',
      query: { id },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  async reactivate(id: number): Promise<void> {
    // `action` va en el body, NUNCA en el query string: el flag [QSA] de
    // mod_rewrite dejaría que `action=reactivate` pise el `action` que la
    // regla de rewrite ya inyectó (api_admin_external_clients), produciendo
    // 404. El controller lee `action` desde POST/JSON body.
    const raw = await http<RawWriteResponse>(LIST_ENDPOINT, {
      method: 'POST',
      query: { id },
      body: { action: 'reactivate' },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  async rotateCredentials(id: number): Promise<{ client_id: string; client_secret: string }> {
    // Mismo motivo que reactivate(): `action` en el body, no en el query.
    const raw = await http<RawWriteResponse>(LIST_ENDPOINT, {
      method: 'POST',
      query: { id },
      body: { action: 'rotate_credentials' },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw as unknown as { client_id: string; client_secret: string };
  },
};
