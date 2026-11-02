import { http } from '../../anagrafiche/services/http';
import { unwrap } from '../../anagrafiche/services/normalizers';
import { ApiError } from '../../anagrafiche/services/api.types';

/**
 * MFA TOTP self-service — Fase A5 del plan de deprecación de `admin_config`
 * (docs/plan-deprecacion-admin-config.md). Portado 1:1 desde
 * `admin_config/src/services/mfa.service.ts`. Único de los 10 lotes de la
 * Fase A sin dependencias cruzadas con el resto — auto-servicio, opera
 * solo sobre el usuario autenticado (defensa en profundidad: no existe
 * gestión de MFA de terceros).
 *
 * Backend:
 *   - controller/api/admin/Mfa_Admin_Controller.php
 *   - service/security/Mfa_Service.php
 */

export interface MfaStatus {
  user_id: number;
  enrolled: boolean;
}

export interface MfaSetupResult {
  secret_base32: string;
  provisioning_uri: string;
  algorithm: string;
  digits: number;
  period: number;
}

export interface MfaVerifyResult {
  mfa_session_token: string;
  expires_in: number;
  usage: string;
}

const ENDPOINT = '/api_admin_mfa_setup';

export const mfaService = {
  async getStatus(): Promise<MfaStatus> {
    const raw = await http<unknown>(ENDPOINT);
    return unwrap<MfaStatus>(raw);
  },

  async setup(): Promise<MfaSetupResult> {
    const raw = await http<unknown>(ENDPOINT, { method: 'POST' });
    return unwrap<MfaSetupResult>(raw);
  },

  async verify(code: string): Promise<MfaVerifyResult> {
    const raw = await http<unknown>(ENDPOINT, {
      method: 'POST',
      query: { action: 'verify' },
      body: { code },
    });
    return unwrap<MfaVerifyResult>(raw);
  },

  async disable(code: string): Promise<{ message: string }> {
    const raw = await http<unknown>(ENDPOINT, {
      method: 'DELETE',
      body: { code },
    });
    return unwrap<{ message: string }>(raw);
  },
};

/**
 * Un código TOTP erróneo llega como 403 (el BFF traduce el 401 del servidor): su mensaje
 * genérico («Forbidden», «Acceso denegado») hace creer que falta un permiso. Se muestra
 * el motivo real (clave `mfa_setup.code_invalid`).
 */
export function mfaCodeErrorMessage(e: unknown, t: (key: string) => string): string {
  if (e instanceof ApiError && (e.status === 403 || e.status === 401)) return t('mfa_setup.code_invalid');
  return e instanceof Error ? e.message : String(e);
}
