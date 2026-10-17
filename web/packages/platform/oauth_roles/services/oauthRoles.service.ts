import { http } from '../../anagrafiche/services/http';
import { ApiError } from '../../anagrafiche/services/api.types';

/**
 * Plantillas de rol OAuth2 (`oauth_role`) — Fase A1 del plan de
 * deprecación de `admin_config` (docs/plan-deprecacion-admin-config.md).
 * Backend: /api_admin_oauth_roles (Oauth_Role_Admin_Controller), admin-only
 * (TMWE). Portado 1:1 desde `admin_config/src/services/oauthRoles.service.ts`.
 */

export interface OAuthRole {
  id: number;
  role_name: string;
  display_name?: string;
  description?: string;
  scopes?: string[] | string;
  allowed_endpoints?: string[] | string | null;
  is_system?: number;
  stato?: string;
  /** Clients OAuth con `oauth_client.role_id` = este rol. */
  client_count?: number;
  /** Usuarios (contatti) con este rol en `contatti_oauth_role`. */
  user_count?: number;
  /**
   * true si el rol contiene scopes restringidos (`admin`, `config:read`,
   * `config:write`): NO asignable a clients OAuth de `client_type='external'`.
   */
  internal_only?: boolean;
  [k: string]: unknown;
}

export type OAuthRoleLite = OAuthRole;

export interface AvailableScope {
  scope: string;
  description: string;
}

export interface CreateOAuthRolePayload {
  role_name: string;
  display_name: string;
  description?: string;
  scopes: string[];
  allowed_endpoints?: string[] | null;
}

export interface UpdateOAuthRolePayload extends CreateOAuthRolePayload {
  id: number;
}

interface RawListResponse {
  success?: boolean;
  roles?: OAuthRole[];
  role?: OAuthRole;
  count?: number;
  error?: string;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  id?: number;
  role_name?: string;
}

interface RawScopesResponse {
  scopes?: AvailableScope[];
  count?: number;
  error?: string;
}

const ENDPOINT = '/api_admin_oauth_roles';
const SCOPES_ENDPOINT = '/api_admin_client_scopes';

function parseList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeRole(r: OAuthRole): OAuthRole {
  const io = (r as Record<string, unknown>).internal_only;
  return {
    ...r,
    scopes: parseList(r.scopes),
    allowed_endpoints: r.allowed_endpoints == null ? null : parseList(r.allowed_endpoints),
    client_count: r.client_count == null ? undefined : Number(r.client_count),
    user_count: r.user_count == null ? undefined : Number(r.user_count),
    internal_only: io === true || io === 1 || io === '1',
  };
}

/**
 * Mensaje humano de un 409 de negocio (`{error:<code>, message}`) — p. ej.
 * ROLE_NOT_ASSIGNABLE (rol solo interno → client externo) o ROLE_IN_USE
 * (borrar un rol con asignaciones). El http() de @shared convierte
 * `error` en el message del ApiError, así que el texto legible hay que
 * leerlo de `details.message`. Devuelve null si no es ese conflicto.
 */
export function roleConflictMessage(e: unknown, code?: string): string | null {
  if (!(e instanceof ApiError) || e.status !== 409) return null;
  const d = (e.details ?? null) as { error?: unknown; message?: unknown } | null;
  if (code != null && d?.error !== code) return null;
  return typeof d?.message === 'string' && d.message ? d.message : e.message;
}

/** true si el rol no puede asignarse a un client OAuth externo. */
export function isInternalOnlyRole(r: Pick<OAuthRole, 'internal_only'> | null | undefined): boolean {
  return r?.internal_only === true;
}

export const oauthRolesService = {
  async list(): Promise<OAuthRole[]> {
    const raw = await http<RawListResponse>(ENDPOINT);
    if (raw?.success === false) throw new Error(raw.error || 'Failed to load roles');
    const roles = Array.isArray(raw?.roles) ? raw!.roles : [];
    return roles.map(normalizeRole);
  },

  async getById(id: number): Promise<OAuthRole | null> {
    if (!id) return null;
    try {
      const raw = await http<RawListResponse>(ENDPOINT, { query: { id } });
      if (raw?.success === false) return null;
      const r = raw?.role ?? null;
      if (!r) return null;
      return normalizeRole(r);
    } catch {
      return null;
    }
  },

  async availableScopes(): Promise<AvailableScope[]> {
    const raw = await http<RawScopesResponse>(SCOPES_ENDPOINT, { query: { view: 'available' } });
    if (raw?.error) throw new Error(raw.error);
    return Array.isArray(raw?.scopes) ? raw!.scopes : [];
  },

  async create(payload: CreateOAuthRolePayload): Promise<{ id: number; role_name: string }> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(raw.error || 'Create failed');
    return { id: raw!.id ?? 0, role_name: raw!.role_name ?? payload.role_name };
  },

  async update(payload: UpdateOAuthRolePayload): Promise<void> {
    const { id, ...body } = payload;
    const raw = await http<RawWriteResponse>(ENDPOINT, {
      method: 'PUT',
      query: { id },
      body,
    });
    if (raw?.success === false) throw new Error(raw.error || 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', query: { id } });
    if (raw?.success === false) throw new Error(raw.error || 'Delete failed');
  },
};
