import { http } from '../../anagrafiche/services/http';

/**
 * Credenciales de proveedores de IA (chat, extracción de ficheros, Whisper,
 * asistente de modelli, clasificación de tracking, COD). Tabla
 * tmwe_ai_credentials. `id_anagrafica: null` = credencial global/TMWE
 * (fallback cuando el partner no tiene la suya). Backend:
 * /api_admin_ai_credentials (AI_Credentials_Admin_Controller), admin-only.
 *
 * La api_key es solo escritura: el backend la cifra (AES-256-GCM) y nunca la
 * devuelve — solo `has_key`. ElevenLabs (voz) tiene su propio panel.
 */

export const AI_PROVIDERS = ['openai', 'anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Sugerencias para el combobox de modelo (el campo admite texto libre). */
export const AI_MODEL_SUGGESTIONS: Record<AiProvider, string[]> = {
  anthropic: ['claude-sonnet-5', 'claude-haiku-4-5'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
};

export interface AiCredential {
  id: number;
  provider: string;
  name?: string | null;
  model?: string | null;
  id_anagrafica: number | null;
  partner_name?: string | null;
  is_default: 'S' | 'N';
  stato?: string;
  has_key?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  [k: string]: unknown;
}

export interface AiCredentialPayload {
  id?: number;
  provider: string;
  id_anagrafica?: number | null;
  name?: string;
  model?: string;
  is_default?: 'S' | 'N';
  /** Solo escritura. Vacío en update = deja la key guardada sin cambios. */
  api_key?: string;
}

export interface AiCredentialTestResult {
  ok: boolean;
  http_status: number | null;
  message: string;
}

interface RawListResponse {
  success?: boolean;
  data?: AiCredential[];
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  message?: string;
}

interface RawTestResponse extends RawWriteResponse, Partial<AiCredentialTestResult> {}

const ENDPOINT = '/api_admin_ai_credentials';

export const aiCredentialsService = {
  async list(idAnagrafica?: number): Promise<AiCredential[]> {
    const query: Record<string, string> = {};
    if (idAnagrafica != null) query.id_anagrafica = String(idAnagrafica);
    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load AI credentials');
    return Array.isArray(raw?.data) ? raw!.data : [];
  },

  async create(payload: AiCredentialPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
  },

  async update(payload: AiCredentialPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'PUT', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },

  /** Marca como default: preferido del partner, o global de ese provider. */
  async setDefault(idAnagrafica: number | null, provider: string): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'POST',
      body: { op: 'set_default', id_anagrafica: idAnagrafica, provider },
    });
    if (raw?.success === false) throw new Error(raw.error || 'Set default failed');
  },

  /** Verifica la key guardada contra la API del provider (no la devuelve). */
  async test(id: number): Promise<AiCredentialTestResult> {
    const raw = await http<RawTestResponse>(ENDPOINT, { method: 'POST', body: { op: 'test', id } });
    if (raw?.success === false) throw new Error(raw.error || 'Test failed');
    return {
      ok: !!raw?.ok,
      http_status: raw?.http_status ?? null,
      message: raw?.message || '',
    };
  },
};
