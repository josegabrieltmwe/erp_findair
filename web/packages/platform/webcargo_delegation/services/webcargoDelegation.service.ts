import { http } from '../../anagrafiche/services/http';

/**
 * Delegación WebCargo REALTIME (par AV/DQ por partner+país,
 * `tmwe_webcargo_delegation`) — sistema DISTINTO de WebCargo Published
 * (`webcargo_key`, ver ../../webcargo_key). Backend:
 * /api_admin_webcargo_delegation (Webcargo_Delegation_Admin_Controller),
 * admin-only (TMWE).
 *
 * Cuando un partner NO tiene delegación activa para un país, WebCargo
 * Realtime lo cotiza en modo DIRECTO con la cuenta principal de la casa
 * (Italia, AV=4939 fijo) — no hay fila que crear ni credencial que
 * gestionar para ese caso, es el comportamiento por defecto
 * (Webcargo_Realtime_Account_Strategy::probe_fallback()).
 */

export interface WebcargoDelegation {
  id: number;
  id_anagrafica: number;
  anagrafica_name?: string;
  av: string;
  dq: string;
  country_iso: string;
  iso_from_to?: string | null;
  av_country?: string | null;
  stato?: string;
  [k: string]: unknown;
}

export interface WebcargoDelegationPayload {
  id?: number;
  id_anagrafica: number;
  av: string;
  dq: string;
  country_iso: string;
  iso_from_to?: string;
  av_country?: string;
}

interface RawListResponse {
  success?: boolean;
  data?: WebcargoDelegation[];
  total?: number;
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  id?: number;
}

const ENDPOINT = '/api_admin_webcargo_delegation';

export const webcargoDelegationService = {
  async list(countryIso?: string, idAnagrafica?: number): Promise<WebcargoDelegation[]> {
    const query: Record<string, string> = {};
    if (countryIso) query.country_iso = countryIso;
    if (idAnagrafica) query.id_anagrafica = String(idAnagrafica);
    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load delegations');
    return Array.isArray(raw?.data) ? raw!.data : [];
  },

  async create(payload: WebcargoDelegationPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
  },

  async update(payload: WebcargoDelegationPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'PUT', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },
};
