import type { FeatureHubGroup, FeatureHubItem, FeatureHubPermissionCheck } from './types';

/**
 * Lógica de filtrado del hub, separada del SFC para poder probarla sin
 * montar el componente (mismo criterio que `anagrafiche/utils/extraTabs.ts`):
 * lo que puede romperse en silencio es qué se ve y en qué orden, no el
 * marcado.
 */

/**
 * Filtra items no autorizados y oculta grupos que se quedan vacíos.
 *
 * Un grupo vacío no debe renderizarse: un encabezado sin items debajo es
 * ruido visual y confunde al operador sobre si el permiso falló o si
 * realmente no hay nada ahí.
 */
export function filterAllowedGroups(
  groups: FeatureHubGroup[],
  allowed: FeatureHubPermissionCheck,
): FeatureHubGroup[] {
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => allowed(item)) }))
    .filter((group) => group.items.length > 0);
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function matchesQuery(item: FeatureHubItem, query: string): boolean {
  if (normalize(item.title).includes(query)) return true;
  if (item.description && normalize(item.description).includes(query)) return true;
  if (item.keywords?.some((k) => normalize(k).includes(query))) return true;
  return false;
}

/**
 * Aplica la búsqueda de texto sobre grupos ya filtrados por permiso.
 *
 * Una query vacía devuelve los grupos sin tocar (evita reconstruir arrays
 * en cada tecleo cuando no hace falta).
 */
export function searchGroups(groups: FeatureHubGroup[], query: string): FeatureHubGroup[] {
  const q = normalize(query);
  if (!q) return groups;

  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => matchesQuery(item, q)) }))
    .filter((group) => group.items.length > 0);
}
