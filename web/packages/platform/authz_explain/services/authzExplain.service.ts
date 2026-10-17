import { http } from '../../anagrafiche/services/http';
import { unwrap } from '../../anagrafiche/services/normalizers';

/**
 * Herramienta de explicación de autorización — Fase A4 del plan de
 * deprecación de `admin_config` (docs/plan-deprecacion-admin-config.md).
 * Consume /api_admin_authz_explain (TMWE admin only) para responder "¿por
 * qué el cliente/usuario X puede/no puede acceder al endpoint Y con método
 * Z?". Portado 1:1 desde `admin_config/src/services/authzExplain.service.ts`.
 *
 * Backend:
 *   - controller/api/admin/Authz_Explain_Controller.php
 *   - service/security/Authz_Service.php::authorize_with_trace
 *
 * No escribe nada — simulador puro (dry-run).
 */

export type AuthzTargetType = 'client' | 'user';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface AuthzExplainQuery {
  targetType: AuthzTargetType;
  targetId: number;
  endpoint: string;
  method?: HttpMethod;
}

export interface AuthzChainStep {
  layer: string;
  result: 'pass' | 'skip' | 'grant' | 'deny' | 'error';
  reason: string;
}

export interface AuthzExplainSubject {
  type: AuthzTargetType;
  id: number;
  user_id: number | null;
  anagrafica_id: number | null;
  auth_mode: 'session' | 'oauth2' | 'jwt';
  label: string;
}

export interface AuthzExplainEndpoint {
  action: string;
  method: HttpMethod;
  policy: Record<string, unknown>;
  audience: string;
}

export interface AuthzExplainResult {
  allowed: boolean;
  decision: 'granted' | 'denied';
  reason: string;
  via: string;
  chain: AuthzChainStep[];
  effective_scopes: string[];
  auth_flags_contribution: Record<string, string[]>;
  required: Record<string, unknown>;
  subject: AuthzExplainSubject;
  endpoint: AuthzExplainEndpoint;
}

const ENDPOINT = '/api_admin_authz_explain';

export const authzExplainService = {
  /** Dry-run de autorización. NO ejecuta el endpoint; solo devuelve lo que Authz_Service DECIDIRÍA, más la cadena de decisión completa. */
  async explain(q: AuthzExplainQuery): Promise<AuthzExplainResult> {
    const params: Record<string, string | number> = {
      target_type: q.targetType,
      target_id: q.targetId,
      endpoint: q.endpoint,
      method: q.method ?? 'GET',
    };
    const raw = await http<unknown>(ENDPOINT, { query: params });
    return unwrap<AuthzExplainResult>(raw);
  },
};
