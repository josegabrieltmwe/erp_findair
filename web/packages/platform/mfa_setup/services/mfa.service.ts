import { http } from '../../anagrafiche/services/http';
import { unwrap } from '../../anagrafiche/services/normalizers';

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
