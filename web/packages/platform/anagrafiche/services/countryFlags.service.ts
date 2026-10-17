import { http } from './http';

/**
 * Flags de comportamiento de dirección por país (usa_prov / usa_cap), leídos
 * de get-api-countries (Web_Country_Controller, hybrid). Deciden si la
 * provincia se muestra como select o texto libre, y si el país usa CAP.
 *
 * prov: 'S' provincia obligatoria (select) | 'F' facultativa (select) |
 *       'N' no usa provincia (texto libre)
 * cap:  'S' usa CAP | 'N' no
 */
export interface CountryAddressFlags {
  prov: 'S' | 'F' | 'N';
  cap: 'S' | 'N';
}

interface RawCountry {
  iso?: string;
  prov_enabled?: string;
  cap_enabled?: string;
  [k: string]: unknown;
}

const ENDPOINT = '/get-api-countries';

let cache: Record<string, CountryAddressFlags> | null = null;
let inFlight: Promise<Record<string, CountryAddressFlags>> | null = null;

function normalize(raw: unknown): Record<string, CountryAddressFlags> {
  const rows: RawCountry[] = Array.isArray(raw)
    ? (raw as RawCountry[])
    : (((raw as { data?: RawCountry[] })?.data) ?? []);
  const map: Record<string, CountryAddressFlags> = {};
  for (const r of rows) {
    const iso = String(r.iso ?? '').toUpperCase();
    if (!iso) continue;
    const prov = (r.prov_enabled === 'S' || r.prov_enabled === 'F') ? r.prov_enabled : 'N';
    const cap = r.cap_enabled === 'S' ? 'S' : 'N';
    map[iso] = { prov: prov as CountryAddressFlags['prov'], cap };
  }
  return map;
}

async function loadAll(): Promise<Record<string, CountryAddressFlags>> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = http<unknown>(ENDPOINT)
      .then((raw) => {
        cache = normalize(raw);
        inFlight = null;
        return cache;
      })
      .catch(() => {
        inFlight = null;
        return {};
      });
  }
  return inFlight;
}

export const countryFlagsService = {
  /** Dict completo iso → flags (cacheado). */
  all: loadAll,

  /** Flags de un país (o defaults conservadores si no se conoce). */
  async get(country: string): Promise<CountryAddressFlags> {
    const iso = (country ?? '').trim().toUpperCase();
    const map = await loadAll();
    return map[iso] ?? { prov: 'N', cap: 'S' };
  },
};
