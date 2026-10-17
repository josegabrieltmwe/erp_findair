import { http } from '../../anagrafiche/services/http';

/**
 * Credenciales ElevenLabs por partner + perfil (copilot_operator |
 * public_form). Cada partner puede tener su propia api_key/agent_id;
 * `partner_id: null` = fila global/TMWE (fallback cuando el partner no
 * tiene la suya propia). Backend: /api_admin_elevenlabs_credentials
 * (Elevenlabs_Credentials_Admin_Controller), admin-only (TMWE).
 * Portado del patrón de ewb_credentials.service.ts.
 */

export const ELEVENLABS_PROFILES = ['copilot_operator', 'public_form'] as const;
export type ElevenlabsProfile = (typeof ELEVENLABS_PROFILES)[number];

export interface ElevenlabsCredential {
  id: number;
  id_anagrafica: number | null;
  partner_name?: string | null;
  profile: string;
  agent_id?: string | null;
  tts_voice_id?: string | null;
  description?: string | null;
  stato?: string;
  has_key?: boolean;
  insert_datetime?: string | null;
  modif_datetime?: string | null;
  [k: string]: unknown;
}

export interface ElevenlabsCredentialPayload {
  id?: number;
  profile: string;
  id_anagrafica?: number | null;
  /** Solo escritura. Vacío en update = deja la key guardada sin cambios. */
  api_key?: string;
  agent_id?: string;
  tts_voice_id?: string;
  description?: string;
}

interface RawListResponse {
  success?: boolean;
  data?: ElevenlabsCredential[];
  total?: number;
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  id?: number;
  data?: ElevenlabsCredential;
}

export interface ElevenlabsCredentialDiagnosis {
  source: 'partner_db' | 'global_db' | 'env_fallback' | 'not_configured';
  api_key_present: boolean;
  agent_id: string | null;
  agent_id_source: 'partner_db' | 'global_db' | 'env_fallback' | 'not_configured';
  tts_voice_id: string | null;
}

interface RawDiagnoseResponse {
  success?: boolean;
  error?: string;
  data?: ElevenlabsCredentialDiagnosis;
}

export interface ElevenlabsCredentialListFilters {
  profile?: string;
  /** Filtra por partner exacto. Usado por el tab embebido en la ficha de
   *  anagrafica (ElevenlabsCredentialsPartnerTab.vue) para listar solo lo
   *  propio de ese partner -- el backend ya soporta este filtro
   *  (Elevenlabs_Credentials_Admin_Controller::get_list()). */
  idAnagrafica?: number;
}

const ENDPOINT = '/api_admin_elevenlabs_credentials';

export const elevenlabsCredentialsService = {
  /**
   * Acepta el `profile` como string suelto (uso histórico, panel admin
   * global) o un objeto de filtros con `idAnagrafica` (tab de partner).
   */
  async list(filters?: string | ElevenlabsCredentialListFilters): Promise<ElevenlabsCredential[]> {
    const normalized: ElevenlabsCredentialListFilters =
      typeof filters === 'string' ? { profile: filters } : (filters ?? {});
    const query: Record<string, string> = {};
    if (normalized.profile) query.profile = normalized.profile;
    if (normalized.idAnagrafica != null) query.id_anagrafica = String(normalized.idAnagrafica);
    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load ElevenLabs credentials');
    return Array.isArray(raw?.data) ? raw!.data : [];
  },

  async create(payload: ElevenlabsCredentialPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
  },

  async update(payload: ElevenlabsCredentialPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'PUT', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },

  /**
   * Resuelve, para un profile+partner, qué capa está sirviendo la
   * credencial efectiva ahora mismo (BD partner / BD global / .env
   * fallback / sin configurar). Nunca devuelve la api_key en claro.
   */
  async diagnose(profile: string, idAnagrafica?: number | null): Promise<ElevenlabsCredentialDiagnosis> {
    const query: Record<string, string> = { diagnose: '1', profile };
    if (idAnagrafica != null) query.id_anagrafica = String(idAnagrafica);
    const raw = await http<RawDiagnoseResponse>(ENDPOINT, { query });
    if (raw?.success === false || !raw?.data) throw new Error(raw?.error || 'Diagnose failed');
    return raw.data;
  },
};
