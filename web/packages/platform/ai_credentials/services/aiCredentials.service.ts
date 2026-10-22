import { http } from '../../anagrafiche/services/http';
import { aiAdminCall } from '../../ai_admin/services/aiAdmin.service';

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

// ---------------------------------------------------------------------------
// «Mis credenciales de IA» (modo propio). Un partner que NO es TMWE gestiona SU
// clave por /api_admin_ai_my_credentials (contrato ai-admin/1). Decisiones:
//  - El partner lo fija el servidor: el cuerpo NUNCA lleva id_anagrafica ni partner_id
//    (ownBody solo deja pasar campos conocidos).
//  - Sin clave propia se usa la de TMWE (`effective.uses_tmwe_key`); quien usa la suya la paga.
//  - No hay op de prueba ni de proveedor por defecto aparte: el defecto es un PUT {is_default}.
//  - TMWE (anagrafica 1) recibe 403: usa api_admin_ai_credentials (aiCredentialsService).
// ---------------------------------------------------------------------------

export interface AiCredentialsEffective {
  /** De donde sale la clave que se usa ahora: la del partner, la global de TMWE o ninguna. */
  source: 'partner' | 'global' | null;
  provider: string | null;
  uses_tmwe_key: boolean;
}

export interface MyAiCredentials {
  items: AiCredential[];
  effective: AiCredentialsEffective | null;
}

export interface MyAiCredentialPayload {
  id?: number;
  /** Solo en alta: el proveedor de una fila no cambia (se desactiva y se crea otra). */
  provider?: string;
  name?: string;
  model?: string;
  is_default?: 'S' | 'N';
  /** Solo escritura. Vacío/ausente en update = deja la clave guardada sin cambios. */
  api_key?: string;
}

const MY_ENDPOINT = '/api_admin_ai_my_credentials';
const MY_FIELDS = ['id', 'provider', 'name', 'model', 'is_default', 'api_key'] as const;

/** Copia solo los campos del contrato; descarta cualquier otro (id_anagrafica, partner_id, stato...). */
function ownBody(payload: MyAiCredentialPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const source = payload as unknown as Record<string, unknown>;
  for (const field of MY_FIELDS) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out;
}

export const myAiCredentialsService = {
  async list(): Promise<MyAiCredentials> {
    const data = await aiAdminCall<{ items?: AiCredential[]; effective?: AiCredentialsEffective | null }>(MY_ENDPOINT);
    const items = Array.isArray(data.items) ? data.items : [];
    // El contrato no devuelve el titular: se normaliza al tipo de fila común.
    return {
      items: items.map((i) => ({ ...i, id_anagrafica: null })),
      effective: data.effective ?? null,
    };
  },

  async create(payload: MyAiCredentialPayload): Promise<void> {
    await aiAdminCall<unknown>(MY_ENDPOINT, { method: 'POST', body: ownBody(payload) });
  },

  /** No envía `provider`: la API no lo cambia. */
  async update(payload: MyAiCredentialPayload): Promise<void> {
    const { provider: _provider, ...rest } = payload;
    await aiAdminCall<unknown>(MY_ENDPOINT, { method: 'PUT', body: ownBody(rest) });
  },

  /** Desactiva la credencial; devuelve de dónde saldrá la clave a partir de ahora. */
  async remove(id: number): Promise<AiCredentialsEffective | null> {
    const data = await aiAdminCall<{ effective?: AiCredentialsEffective | null }>(MY_ENDPOINT, {
      method: 'DELETE',
      query: { id: String(id) },
    });
    return data?.effective ?? null;
  },

  async setDefault(id: number): Promise<void> {
    await aiAdminCall<unknown>(MY_ENDPOINT, { method: 'PUT', body: ownBody({ id, is_default: 'S' }) });
  },
};
