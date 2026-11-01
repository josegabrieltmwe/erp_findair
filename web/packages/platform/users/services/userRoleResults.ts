/**
 * Lógica pura de resultados de roles en el módulo de usuarios (H1, parte SPA).
 */

/**
 * Roles pedidos en el alta que el servidor no concedió. `roles_assigned` trae
 * nombres de rol (el servidor omite en silencio los que su política deniega,
 * p. ej. `root` para un no-root). Compara sin distinguir mayúsculas.
 */
export function rolesNotGranted(
  requested: readonly string[],
  assigned: readonly string[] | undefined | null,
): string[] {
  const granted = new Set((assigned ?? []).map((r) => r.toLowerCase()));
  return requested.filter((r) => !granted.has(r.toLowerCase()));
}

export type BulkRolesToastKind = 'success' | 'warning' | 'error';

/** Tipo de aviso según el resultado de una operación masiva de roles. */
export function bulkRolesToastKind(res: {
  processed: number;
  skipped?: number;
}): BulkRolesToastKind {
  if (res.processed === 0) return 'error';
  if ((res.skipped ?? 0) > 0) return 'warning';
  return 'success';
}
