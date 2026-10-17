import { ref, type Ref } from 'vue';

/**
 * IMPLEMENTACIÓN CANÓNICA — no convertir este fichero en un re-export.
 *
 * Vive aquí, junto a su consumidor `CmEntitySelect.vue`. Las apps que lo
 * necesiten deben reexportarlo desde `@shared/listini/composables/useEntityCache`
 * (ver el shim de admin_config), nunca al revés: en las apps el alias
 * `@shared` apunta a `packages/platform`, así que un `export * from '@shared/…'`
 * escrito AQUÍ se reimporta a sí mismo y rompe el build con
 * "Circular definition of import alias" + "has no exported member".
 *
 * useEntityCache — Module-level singleton cache for static entity lists.
 *
 * The first instance with a given `key` triggers `fetcher()`; all subsequent
 * instances reuse the same in-flight promise (deduplication) and the same
 * resolved array (sharing). Ideal for catalogs that are loaded once per
 * page session: countries, currencies, internal roles, etc.
 *
 * Each call returns its OWN reactive refs, but they're populated from the
 * shared promise — so 50 mounted CmEntitySelect instances with the same
 * cacheKey result in exactly 1 HTTP request.
 *
 * Use `refresh(key)` to invalidate the cache (e.g. after the admin edits the
 * underlying data).
 */

interface CacheEntry<T> {
  promise: Promise<T[]>;
  data: T[] | null;
}

const cache = new Map<string, CacheEntry<unknown>>();

export interface EntityCacheResult<T> {
  items: Ref<T[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  reload: () => Promise<void>;
}

export function useEntityCache<T>(
  key: string,
  fetcher: () => Promise<T[]>,
): EntityCacheResult<T> {
  const items = ref<T[]>([]) as Ref<T[]>;
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(force = false): Promise<void> {
    let entry = cache.get(key) as CacheEntry<T> | undefined;

    if (!entry || force) {
      const promise = fetcher().then((data) => {
        const e = cache.get(key) as CacheEntry<T> | undefined;
        if (e) e.data = data;
        return data;
      });
      entry = { promise, data: null };
      cache.set(key, entry as CacheEntry<unknown>);
    }

    // If data already resolved, just return it synchronously-ish
    if (entry.data) {
      items.value = entry.data;
      return;
    }

    loading.value = true;
    error.value = null;
    try {
      const data = await entry.promise;
      items.value = data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load';
      // Drop the cached promise so subsequent retries can refetch
      cache.delete(key);
    } finally {
      loading.value = false;
    }
  }

  function reload(): Promise<void> {
    return load(true);
  }

  // Kick off the load (fire-and-forget)
  void load();

  return { items, loading, error, reload };
}

/**
 * Invalidate a cache entry without immediately refetching.
 * The next mount or reload() call will fetch fresh data.
 */
export function invalidateEntityCache(key: string): void {
  cache.delete(key);
}

/**
 * Clear ALL cached entries. Useful on logout or workspace switch.
 */
export function clearEntityCache(): void {
  cache.clear();
}
