import { http } from '../../anagrafiche/services/http';

/**
 * Roles internos RBAC (`internal_role`/`internal_role_permission`) — Fase A2
 * del plan de deprecación de `admin_config`
 * (docs/plan-deprecacion-admin-config.md). Backend: /api_admin_internal_roles
 * (Internal_Role_Admin_Controller), admin-only (TMWE). Portado 1:1 desde
 * `admin_config/src/services/internalRoles.service.ts`.
 */

export interface InternalRolePermission {
  id?: number;
  module: string;
  operation: string;
}

export interface InternalRole {
  id: number;
  slug: string;
  name: string;
  description?: string;
  is_system?: number;
  is_active?: number;
  parent_id?: number | null;
  permissions?: InternalRolePermission[];
  user_count?: number;
  [k: string]: unknown;
}

export type InternalRoleLite = InternalRole;

export interface CreateRolePayload {
  slug: string;
  name: string;
  description: string;
  permissions: InternalRolePermission[];
}

export interface UpdateRolePayload extends CreateRolePayload {
  id: number;
}

export interface ClonePayload {
  source_id: number;
  slug: string;
  name: string;
  description: string;
}

interface RawRoleList {
  success?: boolean;
  roles?: InternalRole[];
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  id?: number;
  slug?: string;
  updated?: boolean;
  deleted?: number;
}

interface RawModulesResponse {
  success?: boolean;
  modules?: Record<string, string>;
  error?: string;
}

const ENDPOINT = '/api_admin_internal_roles';
const MODULES_ENDPOINT = '/api_admin_module_permissions';

function ensureSuccess(raw: { success?: boolean; error?: string } | undefined): void {
  if (!raw) throw new Error('Empty response');
  if (raw.success === false) throw new Error(raw.error || 'Request failed');
}

export const internalRolesService = {
  async list(): Promise<InternalRole[]> {
    const raw = await http<RawRoleList>(ENDPOINT);
    ensureSuccess(raw);
    return Array.isArray(raw?.roles) ? raw!.roles : [];
  },

  async getById(id: number): Promise<InternalRole | null> {
    if (!id) return null;
    try {
      const raw = await http<RawRoleList>(ENDPOINT, { query: { id } });
      ensureSuccess(raw);
      const list = raw?.roles;
      if (Array.isArray(list)) return list[0] ?? null;
      return null;
    } catch {
      return null;
    }
  },

  async availableModules(): Promise<Record<string, string>> {
    const raw = await http<RawModulesResponse>(MODULES_ENDPOINT, {
      query: { view: 'available' },
    });
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load modules');
    return raw?.modules ?? {};
  },

  async create(payload: CreateRolePayload): Promise<{ id: number; slug: string }> {
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'POST',
      body: payload,
    });
    ensureSuccess(raw);
    return { id: raw!.id ?? 0, slug: raw!.slug ?? payload.slug };
  },

  async update(payload: UpdateRolePayload): Promise<void> {
    const { id, ...body } = payload;
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'PUT',
      query: { id },
      body,
    });
    ensureSuccess(raw);
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'DELETE',
      query: { id },
    });
    ensureSuccess(raw);
  },

  async clone(payload: ClonePayload): Promise<{ id: number; slug: string }> {
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'POST',
      query: { op: 'clone' },
      body: payload,
    });
    ensureSuccess(raw);
    return { id: raw!.id ?? 0, slug: raw!.slug ?? payload.slug };
  },
};
