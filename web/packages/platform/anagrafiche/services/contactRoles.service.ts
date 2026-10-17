import { http } from './http';

/**
 * Roles RBAC internos de un contatto (usuario del sistema).
 *
 * Un contatto con credenciales es, a efectos de RBAC, un "user" cuyo id es el
 * propio id del contatto (tabla user_role_assignments.user_id). El flujo B
 * (admin_config → Users) los asigna al crear; aquí replicamos SOLO la
 * asignación para el diálogo de permisos del contatto en la ficha de anagrafica,
 * de modo que un contatto creado desde ahí también pueda recibir su rol.
 *
 * SEGURIDAD: ambos endpoints son `admin_only` (solo TMWE, anagrafica id=1). La
 * UI debe gatear la sección de roles con useAnagraficaContext().isTmwe; el
 * backend rechaza igualmente a los partners, así que esto es defensa en
 * profundidad, no la única barrera.
 */

/** Rol interno asignable (catálogo internal_roles). */
export interface InternalRole {
  id: number;
  slug?: string;
  name?: string;
  description?: string;
}

/** Rol ya asignado a un contatto (fila de user_role_assignments + join). */
export interface AssignedRole {
  role_id: number;
  role_slug?: string;
  role_name?: string;
  is_primary?: number;
}

const ROLES_CATALOG = '/api_admin_internal_roles';
const USER_ROLES = '/api_admin_user_roles';

export const contactRolesService = {
  /** Catálogo de roles internos asignables. */
  async listRoles(): Promise<InternalRole[]> {
    const raw = await http<{ roles?: InternalRole[]; error?: string }>(ROLES_CATALOG);
    if (raw?.error) throw new Error(raw.error);
    return raw?.roles ?? [];
  },

  /** IDs de los roles actualmente asignados al contatto. */
  async getAssignedRoleIds(contattoId: number): Promise<number[]> {
    const raw = await http<{ roles?: AssignedRole[]; error?: string }>(USER_ROLES, {
      query: { user_id: contattoId },
    });
    if (raw?.error) throw new Error(raw.error);
    return (raw?.roles ?? []).map((r) => Number(r.role_id)).filter((n) => n > 0);
  },

  /**
   * Reemplaza el conjunto de roles del contatto (paridad saveSecurity del flujo
   * B, sin tocar overrides — aquí solo gestionamos roles). El backend hace
   * replace_user_roles: los role_ids ausentes se revocan.
   */
  async replaceRoles(contattoId: number, roleIds: number[]): Promise<void> {
    const raw = await http<{ error?: string }>(USER_ROLES, {
      method: 'POST',
      query: { user_id: contattoId },
      body: { role_ids: roleIds },
    });
    if (raw?.error) throw new Error(raw.error);
  },
};
