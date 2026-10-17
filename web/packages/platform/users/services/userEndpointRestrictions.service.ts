/**
 * Restricciones de endpoint por usuario (caso SIFARMA: "este usuario solo
 * puede tocar estos N endpoints").
 *
 * Backend: /api_admin_user_endpoint_restrictions
 * El modo se deriva de las filas en cada GET:
 *   - sin filas          → 'unrestricted'
 *   - solo filas deny    → 'blacklist'
 *   - ≥1 fila allow      → 'whitelist' (estricto: lo no listado se deniega)
 *
 * Authz_Service consume estas filas en el paso 5a.
 */
import { http } from '../../anagrafiche/services/http';
import { unwrap } from '../../anagrafiche/services/normalizers';

export type RestrictionEffect = 'allow' | 'deny';

export type RestrictionMode = 'unrestricted' | 'blacklist' | 'whitelist';

export interface EndpointRestriction {
  id: number | null;
  action: string;
  effect: RestrictionEffect;
  reason: string | null;
  granted_by: number | null;
  created_at: string | null;
}

export interface EndpointRestrictionsState {
  user_id: number;
  mode: RestrictionMode;
  restrictions: EndpointRestriction[];
  description: string;
}

const ENDPOINT = '/api_admin_user_endpoint_restrictions';

export const userEndpointRestrictionsService = {
  /** Restricciones actuales de un usuario junto con el modo derivado. */
  async list(userId: number): Promise<EndpointRestrictionsState> {
    const raw = await http<unknown>(`${ENDPOINT}?user_id=${encodeURIComponent(String(userId))}`);
    const data = unwrap<EndpointRestrictionsState>(raw);
    return {
      user_id: data?.user_id ?? userId,
      mode: data?.mode ?? 'unrestricted',
      restrictions: Array.isArray(data?.restrictions) ? data.restrictions : [],
      description: data?.description ?? '',
    };
  },

  /** Crea o actualiza una restricción. Devuelve el estado actualizado. */
  async setRestriction(
    userId: number,
    action: string,
    effect: RestrictionEffect,
    reason: string | null = null,
  ): Promise<EndpointRestrictionsState> {
    await http<unknown>(ENDPOINT, {
      method: 'POST',
      body: { user_id: userId, action, effect, reason },
    });
    return this.list(userId);
  },

  /**
   * Elimina una restricción.
   *
   * NOTA: el backend espera `endpoint_action`, no `action`, porque `action`
   * está reservado por el router para el enrutado.
   */
  async removeRestriction(userId: number, action: string): Promise<EndpointRestrictionsState> {
    const url = `${ENDPOINT}?user_id=${encodeURIComponent(String(userId))}&endpoint_action=${encodeURIComponent(action)}`;
    await http<unknown>(url, { method: 'DELETE' });
    return this.list(userId);
  },

  /** Elimina todas las restricciones (el usuario vuelve a 'unrestricted'). */
  async removeAll(userId: number): Promise<EndpointRestrictionsState> {
    const url = `${ENDPOINT}?user_id=${encodeURIComponent(String(userId))}`;
    await http<unknown>(url, { method: 'DELETE' });
    return this.list(userId);
  },
};
