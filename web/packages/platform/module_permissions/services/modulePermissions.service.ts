import { http } from '../../anagrafiche/services/http';

/**
 * modulePermissions.service — CRUD admin para la tabla legacy
 * `module_permissions` (concesiones por usuario). Backend:
 * /api_admin_module_permissions.
 *
 * Esta tabla es la predecesora de `user_permission_overrides` y sigue
 * siendo consultada por Module_Permission_Service como fallback cuando un
 * usuario no tiene rol RBAC. Útil para concesiones puntuales de grano fino
 * sin crear un rol.
 */

export interface ModulePermissionEntry {
  permission: string; // 'read' | 'write' | 'delete' | 'admin'
  granted_by?: number | null;
  granted_at?: string | null;
}

export interface UserPermissions {
  user_id: number;
  /** nombre de módulo -> lista de {permission, granted_by, granted_at} */
  permissions: Record<string, ModulePermissionEntry[]>;
  total: number;
}

export interface AvailableModules {
  modules: Record<string, string>; // clave de módulo -> descripción
  permissions: string[]; // operaciones de permiso válidas
  permission_descriptions: Record<string, string>;
  legacy_map?: Record<string, Record<string, string[]>>;
}

export interface UserSummary {
  id: number;
  nome: string;
  mail: string;
  loginn: string;
  ruolo?: string;
  id_anagrafica: number;
  rag_soc?: string;
  nome_breve?: string;
  perm_count: number;
  module_count: number;
}

export interface UsersSummaryPage {
  users: UserSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  stats: {
    user_count: number;
    perm_count: number;
    module_count: number;
  };
}

export interface SearchUser {
  id: number;
  nome: string | null;
  mail: string | null;
  loginn: string | null;
  ruolo: string | null;
  id_anagrafica: number;
  rag_soc: string | null;
  nome_breve: string | null;
}

export interface Grant {
  module: string;
  permission: string;
}

const ENDPOINT = '/api_admin_module_permissions';
const BULK_ENDPOINT = '/api_admin_module_permissions_bulk';

export const modulePermissionsService = {
  async getAvailable(): Promise<AvailableModules> {
    const raw = await http<AvailableModules>(ENDPOINT, { query: { view: 'available' } });
    return raw;
  },

  async getUserPermissions(userId: number): Promise<UserPermissions> {
    const raw = await http<UserPermissions>(ENDPOINT, { query: { user_id: userId } });
    return raw;
  },

  async getUsersSummary(opts: { page?: number; per_page?: number; search?: string; module?: string } = {}): Promise<UsersSummaryPage> {
    const query: Record<string, string | number> = { view: 'users_summary' };
    if (opts.page) query.page = opts.page;
    if (opts.per_page) query.per_page = opts.per_page;
    if (opts.search) query.search = opts.search;
    if (opts.module) query.module = opts.module;
    const raw = await http<UsersSummaryPage>(ENDPOINT, { query });
    return raw;
  },

  async searchUsers(search: string): Promise<SearchUser[]> {
    if (search.trim().length < 2) return [];
    const raw = await http<{ data?: SearchUser[]; error?: string }>(ENDPOINT, {
      query: { view: 'search_users', search },
    });
    return Array.isArray(raw?.data) ? raw!.data! : [];
  },

  async grant(userId: number, module: string, permission: string): Promise<void> {
    const raw = await http<{ success?: boolean; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { user_id: userId, module, permission },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  async revoke(userId: number, module: string, permission: string): Promise<void> {
    const raw = await http<{ success?: boolean; error?: string }>(ENDPOINT, {
      method: 'DELETE',
      body: { user_id: userId, module, permission },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  /**
   * Reemplazo atómico de todos los permisos de un usuario. Se pasa el
   * conjunto deseado completo de concesiones {module, permission}. El
   * backend hace DELETE de todo lo del usuario e INSERT del nuevo conjunto
   * dentro de una transacción.
   */
  async replaceAll(userId: number, grants: Grant[]): Promise<{ granted: number }> {
    const raw = await http<{ success?: boolean; granted?: number; error?: string; details?: string[] }>(
      BULK_ENDPOINT,
      { method: 'PUT', body: { user_id: userId, grants } },
    );
    if (raw?.error) {
      const detail = raw.details?.length ? `: ${raw.details.join(', ')}` : '';
      throw new Error((raw.error || 'Request failed') + detail);
    }
    return { granted: raw?.granted ?? 0 };
  },
};
