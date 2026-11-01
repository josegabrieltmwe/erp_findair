import type { ApiRoleRef, ApiRoleState } from './contatti.service';

/**
 * Qué puede hacer QUIEN MIRA con los roles de un contacto, a partir de lo que informa el API
 * (`grantable_roles`). La UI no repite la política: ofrece solo lo que el servidor aceptará.
 */
export interface ApiRoleOptions {
  /** Roles aditivos que tiene el contacto, con indicación de si el llamante puede retirarlos. */
  held: Array<ApiRoleRef & { removable: boolean }>;
  /** Roles aditivos que se pueden añadir (concedibles y que aún no tiene). */
  addable: ApiRoleRef[];
  /** Roles base que se pueden asignar (concedibles, no aditivos). */
  baseChoices: ApiRoleRef[];
  /** `true` si el llamante puede cambiar algo de este contacto. */
  canEdit: boolean;
}

export function apiRoleOptions(state: ApiRoleState | null): ApiRoleOptions {
  if (!state) return { held: [], addable: [], baseChoices: [], canEdit: false };
  const grantableIds = new Set(state.grantable_roles.map((r) => r.id));
  const heldIds = new Set(state.addon_roles.map((r) => r.id));
  const held = state.addon_roles.map((r) => ({ ...r, removable: grantableIds.has(r.id) }));
  const addable = state.grantable_roles.filter((r) => r.addon && !heldIds.has(r.id));
  const baseChoices = state.grantable_roles.filter((r) => !r.addon);
  return {
    held,
    addable,
    baseChoices,
    canEdit: addable.length > 0 || baseChoices.length > 0 || held.some((r) => r.removable),
  };
}
