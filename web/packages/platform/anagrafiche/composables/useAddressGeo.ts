import { ref, watch, type Ref } from 'vue';
import { countryFlagsService } from '../services/countryFlags.service';
import { provinceService, type ProvinceOption } from '../services/province.service';
import { geoService } from '../services/geo.service';

/**
 * useAddressGeo — orquesta los campos de dirección dependientes del país
 * (provincia / ciudad / CAP) para los componentes CmProvinciaSelect,
 * CmCittaField y CmCapField.
 *
 * Dado un `country` reactivo:
 *  - decide si la provincia es 'select' (usa_prov ∈ S,F) o 'free' (N),
 *  - carga la lista de provincias del país cuando aplica,
 *  - expone lookupCap(cap) → rellena citySuggestions y devuelve {provShort, cities}.
 *
 * Estados con etiqueta "State" (US/CA/GB) vs "Province" para el resto.
 */

export type ProvinceMode = 'select' | 'free';

const STATE_COUNTRIES = new Set(['US', 'CA', 'GB', 'AU']);

export function useAddressGeo(country: Ref<string>) {
  const provinceMode = ref<ProvinceMode>('free');
  const provinceItems = ref<ProvinceOption[]>([]);
  const citySuggestions = ref<string[]>([]);
  const usaCap = ref(true);
  const loadingProv = ref(false);
  const loadingCap = ref(false);

  let capTimer: ReturnType<typeof setTimeout> | null = null;

  async function onCountryChange(iso: string): Promise<void> {
    const code = (iso ?? '').trim().toUpperCase();
    citySuggestions.value = [];
    if (!code) {
      provinceMode.value = 'free';
      provinceItems.value = [];
      usaCap.value = true;
      return;
    }
    loadingProv.value = true;
    try {
      const flags = await countryFlagsService.get(code);
      usaCap.value = flags.cap === 'S';
      if (flags.prov === 'S' || flags.prov === 'F') {
        provinceMode.value = 'select';
        provinceItems.value = await provinceService.list(code);
        // Si el catálogo llega vacío pese al flag, degradar a texto libre.
        if (provinceItems.value.length === 0) provinceMode.value = 'free';
      } else {
        provinceMode.value = 'free';
        provinceItems.value = [];
      }
    } finally {
      loadingProv.value = false;
    }
  }

  /**
   * Resuelve el CAP → ciudad(es) + provincia. Devuelve provShort y cities para
   * que el consumidor rellene sus campos (respetando "no sobrescribir").
   */
  async function lookupCap(cap: string): Promise<{ provShort: string | null; cities: string[] }> {
    const iso = (country.value ?? '').trim().toUpperCase();
    const c = (cap ?? '').trim();
    if (!iso || c.length < 3) return { provShort: null, cities: [] };
    loadingCap.value = true;
    try {
      const r = await geoService.lookupCap({ country: iso, cap: c });
      citySuggestions.value = Array.isArray(r.cities) ? r.cities : [];
      const ps = r.prov_short;
      const provShort = ps && typeof ps === 'string' && ps.trim() !== '' ? ps : null;
      return { provShort, cities: citySuggestions.value };
    } catch {
      return { provShort: null, cities: [] };
    } finally {
      loadingCap.value = false;
    }
  }

  /** Igual que lookupCap pero con debounce (para @update:model-value). */
  function lookupCapDebounced(cap: string, cb: (r: { provShort: string | null; cities: string[] }) => void): void {
    if (capTimer) clearTimeout(capTimer);
    capTimer = setTimeout(() => {
      lookupCap(cap).then(cb);
    }, 300);
  }

  function provinceLabelKey(iso: string): string {
    return STATE_COUNTRIES.has((iso ?? '').toUpperCase())
      ? 'anagrafiche.fields.state'
      : 'anagrafiche.fields.province';
  }

  watch(country, (c) => onCountryChange(c ?? ''), { immediate: true });

  return {
    provinceMode,
    provinceItems,
    citySuggestions,
    usaCap,
    loadingProv,
    loadingCap,
    lookupCap,
    lookupCapDebounced,
    provinceLabelKey,
  };
}
