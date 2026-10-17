import { http } from '../../anagrafiche/services/http';
import { paginated } from '../../anagrafiche/services/normalizers';

/**
 * Usuarios (`contatti` con acceso al ERP) — Fase A2 del plan de deprecación
 * de `admin_config` (docs/plan-deprecacion-admin-config.md). Backend:
 * /api_admin_users (CRUD), /api_admin_user_roles_web (perfil de seguridad),
 * /api_admin_user_role_bulk (asignación masiva), /api_admin_module_permissions
 * (catálogo de módulos), /api_admin_external_clients (OAuth clients del
 * usuario, solo lectura). Todos admin-only (TMWE). Portado 1:1 desde
 * `admin_config/src/services/users.service.ts`.
 *
 * Reemplaza el subconjunto mínimo que vivía en
 * `packages/platform/oauth_clients/services/users.service.ts` (Fase A1,
 * solo search/getById para el selector) — ese archivo se mantiene como
 * re-export de este para no romper el import existente.
 */

export interface UserLite {
  id: number;
  nome: string;
  mail: string;
  loginn: string;
  ruolo?: string;
  id_anagrafica: number;
  auth_10?: string; // 'S' = acceso web, 'N' = solo API
  stato?: string;
  rag_soc?: string; // nombre de la empresa (JOIN)
  role_names?: string; // roles separados por coma
  [k: string]: unknown;
}

export interface UserCreatePayload {
  nome: string;
  mail?: string;
  id_anagrafica: number;
  ruolo?: string;
  role_ids?: number[];
  api_only?: boolean;
}

export interface UserUpdatePayload {
  nome?: string;
  mail?: string;
  ruolo?: string;
  id_sede_interna?: number;
  // Plan v5 F1-F7: flags auth_* editables por el mismo PUT.
  // Whitelist del backend: auth_10, auth_18..auth_22.
  auth_10?: 'S' | 'N';
  auth_18?: 'S' | 'N';
  auth_19?: 'S' | 'N';
  auth_20?: 'S' | 'N';
  auth_21?: 'S' | 'N';
  auth_22?: 'S' | 'N';
}

export interface UserCredentials {
  loginn: string;
  password: string;
}

export interface UserListFilters {
  page?: number;
  perPage?: number;
  status?: 'active' | 'all';
  search?: string;
  anagraficaId?: number;
  // Tipo de usuario: 'S' = acceso ERP/panel, 'N' = solo API/B2B (columna auth_10).
  auth10?: 'S' | 'N';
}

export interface UserListResult {
  items: UserLite[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

const ENDPOINT = '/api_admin_users';

export const usersService = {
  /**
   * Listado paginado, con búsqueda (usado por la tabla de la página y por
   * CmUserAutocomplete). Backend soporta ?search= sobre (nome, mail,
   * loginn, anagrafica.rag_soc).
   */
  async list(filters: UserListFilters = {}): Promise<UserListResult> {
    const params: Record<string, string | number> = {
      page: filters.page ?? 1,
      per_page: filters.perPage ?? 20,
      status: filters.status ?? 'active',
    };
    if (filters.search) params.search = filters.search;
    if (filters.anagraficaId && filters.anagraficaId > 0) {
      params.anagrafica_id = filters.anagraficaId;
    }
    if (filters.auth10 === 'S' || filters.auth10 === 'N') {
      params.auth_10 = filters.auth10;
    }
    const raw = await http<unknown>(ENDPOINT, { query: params });
    const page = paginated<UserLite>(raw, 'users');
    return {
      items: page.items,
      total: page.total,
      page: page.page,
      perPage: page.perPage,
      pages: page.pages,
    };
  },

  /** Búsqueda ligera usada por CmUserAutocomplete. */
  async search(query: string, perPage = 25, anagraficaId?: number): Promise<UserLite[]> {
    const result = await this.list({
      search: query,
      perPage,
      anagraficaId,
    });
    return result.items;
  },

  async getById(id: number): Promise<UserLite | null> {
    if (!id) return null;
    try {
      const raw = await http<{ user?: UserLite; data?: UserLite }>(ENDPOINT, {
        query: { id },
      });
      if (raw && typeof raw === 'object') {
        if (raw.user) return raw.user;
        if (raw.data) return raw.data;
      }
      return null;
    } catch {
      return null;
    }
  },

  /** Crea un usuario nuevo. Devuelve credenciales autogeneradas (una sola vez). */
  async create(payload: UserCreatePayload): Promise<UserCredentials> {
    const body = {
      action: 'create',
      nome: payload.nome,
      mail: payload.mail ?? '',
      id_anagrafica: payload.id_anagrafica,
      ruolo: payload.ruolo ?? '',
      role_ids: payload.role_ids ?? [],
      auth_10: payload.api_only ? 'N' : 'S',
    };
    const raw = await http<{ loginn?: string; password?: string; error?: string }>(
      ENDPOINT,
      { method: 'POST', body },
    );
    if (raw?.error) throw new Error(raw.error);
    if (!raw?.loginn || !raw?.password) {
      throw new Error('Server did not return credentials');
    }
    return { loginn: raw.loginn, password: raw.password };
  },

  /** Actualiza nombre/email/rol de un usuario existente. */
  async update(id: number, payload: UserUpdatePayload): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'PUT',
      query: { id },
      body: payload,
    });
    if (raw?.error) throw new Error(raw.error);
  },

  /** Reset de contraseña (iniciado por admin). Devuelve la nueva contraseña en claro. */
  async resetPassword(userId: number): Promise<string> {
    const raw = await http<{ password?: string; error?: string }>(ENDPOINT, {
      method: 'POST',
      body: { action: 'reset_password', user_id: userId },
    });
    if (raw?.error) throw new Error(raw.error);
    if (!raw?.password) throw new Error('Server did not return new password');
    return raw.password;
  },

  /** Soft-delete (stato='O'). */
  async remove(id: number): Promise<void> {
    const raw = await http<{ error?: string }>(ENDPOINT, {
      method: 'DELETE',
      query: { id },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  // =========================================================================
  // PERFIL DE SEGURIDAD — roles, overrides, permisos efectivos
  // =========================================================================

  /** Snapshot completo de seguridad de un usuario. */
  async getSecurityProfile(userId: number): Promise<UserSecurityProfile> {
    const raw = await http<UserSecurityProfile & { error?: string }>(ROLES_ENDPOINT, {
      query: { user_id: userId },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw;
  },

  /** Reemplaza roles + overrides de un usuario en una sola llamada. */
  async saveSecurity(
    userId: number,
    roleIds: number[],
    overrides: UserOverride[],
  ): Promise<void> {
    const raw = await http<{ error?: string }>(ROLES_ENDPOINT, {
      method: 'POST',
      query: { user_id: userId },
      body: { role_ids: roleIds, overrides },
    });
    if (raw?.error) throw new Error(raw.error);
  },

  /** Asigna o revoca un rol en bloque para varios usuarios. */
  async bulkAssignRole(
    userIds: number[],
    roleId: number,
    action: 'grant' | 'revoke',
  ): Promise<{ processed: number; skipped?: number }> {
    const raw = await http<{
      processed?: number;
      skipped?: number;
      error?: string;
    }>(BULK_ROLE_ENDPOINT, {
      method: 'POST',
      body: { user_ids: userIds, role_id: roleId, action },
    });
    if (raw?.error) throw new Error(raw.error);
    return { processed: raw.processed ?? 0, skipped: raw.skipped };
  },

  /** Catálogo de módulos (key → descripción). Cachear en cliente vía useEntityCache. */
  async getAvailableModules(): Promise<Record<string, string>> {
    const raw = await http<{
      modules?: Record<string, string>;
      error?: string;
    }>(MODULE_PERMISSIONS_ENDPOINT, {
      query: { view: 'available' },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.modules ?? {};
  },

  /** OAuth clients vinculados a un usuario (resumen de solo lectura). */
  async listOauthClientsForUser(userId: number): Promise<OAuthClientSummary[]> {
    const raw = await http<{
      clients?: OAuthClientSummary[];
      error?: string;
    }>(EXTERNAL_CLIENTS_ENDPOINT, {
      query: { user_id: userId },
    });
    if (raw?.error) throw new Error(raw.error);
    return raw?.clients ?? [];
  },
};

// =========================================================================
// Tipos — formas del perfil de seguridad
// =========================================================================

// NOTA: el docblock de Web_User_Role_Admin_Controller.php documenta
// "/api_admin_user_roles_web" pero la única ruta registrada en
// config/routes/permissions.yml es "api_admin_user_roles" (sin "_web") —
// verificado en vivo: "_web" da 404, la ruta sin sufijo responde 200. El
// mismo bug existe hoy en admin_config/src/services/users.service.ts
// (UserSecurityPanel.vue está roto en esa app por este motivo). Se usa
// aquí la ruta real, no la documentada.
const ROLES_ENDPOINT = '/api_admin_user_roles';
const BULK_ROLE_ENDPOINT = '/api_admin_user_role_bulk';
const MODULE_PERMISSIONS_ENDPOINT = '/api_admin_module_permissions';
const EXTERNAL_CLIENTS_ENDPOINT = '/api_admin_external_clients';

export type OverrideEffect = 'grant' | 'deny';
export type OverrideOperation = 'read' | 'write' | 'delete' | 'admin';

export interface UserOverride {
  module: string;
  operation: OverrideOperation;
  effect: OverrideEffect;
  reason?: string;
}

export interface UserRoleRef {
  role_id: number;
  name?: string;
  is_system?: number;
}

export interface UserLegacyAuth {
  // Plan v5 F1-F7: los 15 flags contatti.auth_* expuestos para AuthFlagsEditor.
  // Cada valor es 'S' (concedido) o 'N' (denegado).
  auth_10?: string;
  auth_11?: string;
  auth_12?: string;
  auth_13?: string;
  auth_14?: string;
  auth_15?: string;
  auth_16?: string;
  auth_17?: string;
  auth_18?: string;
  auth_19?: string;
  auth_20?: string;
  auth_21?: string;
  auth_22?: string;
  auth_23?: string;
  auth_24?: string;
  [k: `auth_${number}`]: string | undefined;
}

/**
 * Matriz de permisos efectivos: { modulo: { op: origen } }
 * donde origen es 'role' | 'grant' | 'deny'.
 */
export type EffectivePermissions = Record<string, Record<string, string>>;

export interface UserSecurityProfile {
  success: boolean;
  user: {
    id: number;
    nome: string;
    mail?: string;
    loginn: string;
    rag_soc?: string;
    id_anagrafica: number;
  };
  legacy: UserLegacyAuth;
  roles: UserRoleRef[];
  overrides: UserOverride[];
  effective: EffectivePermissions;
  oauth_clients?: OAuthClientSummary[];
}

export interface OAuthClientSummary {
  id: number;
  client_id?: string;
  client_name?: string;
  company_name?: string;
  client_type?: 'internal' | 'external' | string | null;
  role_id?: number | null;
  tier?: string;
  stato?: string;
  status?: string;
  scope_count?: number;
  scopes?: unknown[];
  role_name?: string;
  last_activity?: string;
  [k: string]: unknown;
}
