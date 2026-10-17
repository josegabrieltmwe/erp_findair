import { useLocalStorage } from '@vueuse/core';
import type { RemovableRef } from '@vueuse/core';

export type ListViewMode = 'paginated' | 'infinite';

/**
 * Persists the user's preferred list view mode in localStorage so it
 * survives reloads and applies across both cargo and shipment SPAs
 * (the localStorage origin is the same for both, sharing the choice).
 *
 * `key` lets callers namespace per-list if a single user wants different
 * defaults for cargo vs courier; defaults to a single shared key so the
 * preference is global by default.
 */
export function useListViewMode(
  key = 'tmwe:list-view-mode',
  defaultMode: ListViewMode = 'paginated',
): RemovableRef<ListViewMode> {
  return useLocalStorage<ListViewMode>(key, defaultMode);
}
