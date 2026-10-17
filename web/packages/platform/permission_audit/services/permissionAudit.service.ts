import { http } from '../../anagrafiche/services/http';
import { unwrap } from '../../anagrafiche/services/normalizers';

/**
 * Visor de auditoría de permisos — Fase A4 del plan de deprecación de
 * `admin_config` (docs/plan-deprecacion-admin-config.md). Consume
 * /api_admin_permission_audit (TMWE admin only) para mostrar el historial
 * de cambios de permisos. Portado 1:1 desde
 * `admin_config/src/services/permissionAudit.service.ts`.
 *
 * Backend:
 *   - controller/api/admin/Permission_Audit_Controller.php
 *   - service/rbac/Permission_Audit_Service.php
 *   - tabla: permission_audit_log
 *
 * Sumidero de solo lectura de todo lo que escriben users/internal_roles/
 * module_permissions/oauth_roles (Fase A1-A2) — no tiene sentido migrarlo
 * antes de que exista algo reciente que mostrar.
 */

export type AuditTargetType = 'user' | 'role' | 'oauth_client';

export type AuditAction =
  | 'role_granted'
  | 'role_revoked'
  | 'override_added'
  | 'override_removed'
  | 'module_permission_granted'
  | 'module_permission_revoked'
  | 'module_permission_bulk_updated'
  | 'oauth_scope_granted'
  | 'oauth_scope_revoked'
  | 'role_created'
  | 'role_updated'
  | 'role_deleted'
  | 'role_cloned'
  | 'auth_flag_changed';

export interface PermissionAuditEntry {
  id: number;
  action: AuditAction | string;
  target_type: AuditTargetType | string;
  target_id: number;
  changed_by: number;
  change_diff: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  occurred_at: string;
}

export interface AuditQueryByTarget {
  targetType: AuditTargetType;
  targetId: number;
  limit?: number;
}

export interface AuditQueryByActor {
  changedBy: number;
  limit?: number;
}

export interface AuditQueryResult {
  scope: {
    target_type?: string;
    target_id?: number;
    changed_by?: number;
  };
  items: PermissionAuditEntry[];
}

const ENDPOINT = '/api_admin_permission_audit';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

export const permissionAuditService = {
  /** Historial de cambios de permisos que afectan a un target específico (user/role/oauth_client). */
  async byTarget(q: AuditQueryByTarget): Promise<AuditQueryResult> {
    const params: Record<string, string | number> = {
      target_type: q.targetType,
      target_id: q.targetId,
      limit: clampLimit(q.limit),
    };
    const raw = await http<unknown>(ENDPOINT, { query: params });
    // El backend devuelve {success, scope, items} en el nivel superior (sin wrapper `data`).
    return unwrap<AuditQueryResult>(raw);
  },

  /** Historial de cambios de permisos realizados POR un admin específico. */
  async byActor(q: AuditQueryByActor): Promise<AuditQueryResult> {
    const params: Record<string, string | number> = {
      changed_by: q.changedBy,
      limit: clampLimit(q.limit),
    };
    const raw = await http<unknown>(ENDPOINT, { query: params });
    return unwrap<AuditQueryResult>(raw);
  },
};
