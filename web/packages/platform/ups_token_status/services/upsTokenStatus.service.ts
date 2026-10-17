import { http } from '../../anagrafiche/services/http';

/**
 * Estado de solo lectura del token OAuth de UPS (`ups_auth_token`, tabla
 * del módulo standalone `tmwe_ups/`). Réplica moderna, alcance reducido, de
 * la parte "Token UPS" de `home_box_8.php`.
 *
 * ⚠️ Sin renovar/revocar: esa lógica sigue viviendo en
 * `tmwe_ups\service\Security`, invocada desde ese módulo. Este endpoint solo
 * lee estado — nunca el token/refresh_token en sí (el backend ya los excluye
 * explícitamente).
 *
 * Backend: /api_admin_ups_token_status (Ups_Token_Status_Controller).
 */

export interface UpsTokenStatus {
  has_token: boolean;
  is_expired?: boolean;
  use_before?: string | null;
  refresh_token_use_before?: string | null;
  client_id?: string | null;
  created_at?: string | null;
  total_issued: number;
}

const BASE = '/api_admin_ups_token_status';

export const upsTokenStatusService = {
  async get(): Promise<UpsTokenStatus> {
    const raw = await http<{ success?: boolean; data?: UpsTokenStatus }>(BASE);
    return raw.data ?? { has_token: false, total_issued: 0 };
  },
};
