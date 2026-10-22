import { AiAdminError } from '../ai_admin/services/aiAdmin.service';
import type { AiCredentialPayload, AiCredentialsEffective } from './services/aiCredentials.service';

/**
 * Reglas del formulario de credenciales de IA, sin Vue: el componente las usa y los specs las prueban
 * (en este monorepo vitest corre en entorno node, sin montar componentes).
 */

/** 'own' = clave propia (la paga el partner), 'tmwe' = fallback a la clave de TMWE, 'none' = ninguna. */
export type EffectiveKind = 'own' | 'tmwe' | 'none';

export function effectiveKind(effective: AiCredentialsEffective | null): EffectiveKind {
  if (!effective || effective.source === null) return 'none';
  return effective.uses_tmwe_key ? 'tmwe' : 'own';
}

/**
 * Mensaje de un error. En modo propio, AI_FORBIDDEN (el usuario no tiene el rol de administrador de IA, o
 * es TMWE) se sustituye por `forbiddenText`; el resto conserva el texto de la API (AI_VALIDATION, etc.).
 */
export function describeCredentialError(e: unknown, own: boolean, forbiddenText: string): string {
  if (own && e instanceof AiAdminError && e.code === 'AI_FORBIDDEN') return forbiddenText;
  return e instanceof Error ? e.message : String(e);
}

export interface CredentialFormValues {
  id?: number;
  provider: string;
  id_anagrafica: number | null;
  /** Solo escritura: nunca se precarga con una clave existente. */
  api_key: string;
  model: string;
  name: string;
  is_default: boolean;
  /** Estado original, para enviar is_default solo si cambió. */
  was_default: boolean;
}

/**
 * Payload de alta/edición. Modo propio: NUNCA lleva id_anagrafica (el partner lo fija el servidor). La
 * clave solo se envía si el usuario la escribió (vacío en edición = se conserva la guardada).
 */
export function buildCredentialPayload(
  form: CredentialFormValues,
  mode: 'create' | 'edit',
  own: boolean,
): AiCredentialPayload {
  const payload: AiCredentialPayload = {
    id: form.id,
    provider: form.provider,
    ...(own ? {} : { id_anagrafica: form.id_anagrafica }),
    model: (form.model || '').trim(),
    name: form.name.trim(),
  };
  if (mode === 'create' || form.is_default !== form.was_default) {
    payload.is_default = form.is_default ? 'S' : 'N';
  }
  if (form.api_key.trim()) payload.api_key = form.api_key.trim();
  return payload;
}
