/**
 * Lógica pura de las cuentas root en el módulo de usuarios (P42).
 *
 * El API devuelve 403 `ROLE_ROOT_ONLY` cuando alguien que no es root actúa sobre una cuenta root (editar, restablecer
 * contraseña, dar de baja) y, en el alta, `roles_denied` si se pide el rol root sin serlo. La SPA solo adelanta lo
 * que ya sabe (para no ofrecer una acción condenada); la autorización real es siempre la del servidor.
 */

/** Nombre del rol que marca una cuenta root. */
export const ROOT_ROLE_NAME = 'root';

/** ¿La cuenta tiene el rol root? `role_names` del listado viene separado por comas. */
export function isRootUser(user: { role_names?: unknown } | null | undefined): boolean {
  const raw = user?.role_names;
  if (typeof raw !== 'string' || raw.trim() === '') return false;
  return raw
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .includes(ROOT_ROLE_NAME);
}

/**
 * ¿Hay que deshabilitar las acciones sobre esta cuenta? Solo si sabemos que es root Y sabemos que quien actúa no lo
 * es. Si el perfil no informó `access` (`known = false`) no se bloquea nada: el servidor responderá con su mensaje.
 */
export function rootActionBlocked(
  target: { role_names?: unknown } | null | undefined,
  caller: { isRoot: boolean; known: boolean },
): boolean {
  return isRootUser(target) && caller.known && !caller.isRoot;
}

/** Elemento de `roles_denied` de la respuesta del alta. */
export interface RoleDenied {
  role_id?: number;
  role_name?: string | null;
  code?: string;
}

/** Normaliza `roles_denied` (descarta lo que no sea una lista de objetos). */
export function parseRolesDenied(raw: unknown): RoleDenied[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      role_id: typeof r.role_id === 'number' ? r.role_id : undefined,
      role_name: typeof r.role_name === 'string' ? r.role_name : null,
      code: typeof r.code === 'string' ? r.code : undefined,
    }));
}

/**
 * Texto de los roles no concedidos: «root (motivo), otro (motivo)». El motivo sale de `errors.api.<code>` si existe;
 * sin traducción solo se nombra el rol.
 */
export function formatRolesDenied(
  denied: readonly RoleDenied[],
  i18n: { t: (key: string) => string; te: (key: string) => boolean },
): string {
  return denied
    .map((d) => {
      const name = d.role_name || (d.role_id != null ? `#${d.role_id}` : '?');
      const key = d.code ? `errors.api.${d.code}` : '';
      return key && i18n.te(key) ? `${name} (${i18n.t(key)})` : name;
    })
    .join(', ');
}
