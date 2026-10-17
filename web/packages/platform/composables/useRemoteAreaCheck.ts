import { ref, type Ref } from 'vue';
import { geoService } from '@shared/services/geo.service';

/**
 * Reactive wrapper around ajax_remote_zone_check. Components watch the
 * (country, cap, city) tuple of an address and the composable updates
 * `remote` ('S' | 'N' | null) accordingly.
 */
export function useRemoteAreaCheck() {
  const remote: Ref<'S' | 'N' | null> = ref(null);
  const loading = ref(false);

  let lastKey = '';

  async function check(country: string, cap: string, city: string, which: 'x1' | 'x2'): Promise<'S' | 'N'> {
    const key = [country, cap, city, which].join('|');
    if (key === lastKey && remote.value !== null) return remote.value;
    lastKey = key;
    loading.value = true;
    try {
      const r = await geoService.isRemote({ country, cap, city, which });
      remote.value = r.remote;
      return r.remote;
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    remote.value = null;
    lastKey = '';
  }

  return { remote, loading, check, reset };
}
