import { http } from './http';

/**
 * Provincias/estados por país. Envuelve api_provinces (Web_Prov_Controller,
 * hybrid auth). Alimenta CmProvinciaSelect. value = code (sigla, ej. "MI"/"NY").
 *
 * NOTA: el endpoint devuelve las provincias de cap_province SIN filtrar por el
 * flag usa_prov (la decisión select-vs-libre la toma countryFlags.service). Sí
 * filtramos aquí las filas placeholder con sigla 'xx' (convención legacy).
 */
export interface ProvinceOption {
  code: string; // sigla
  name: string;
}

interface RawProvince {
  id?: number;
  country?: string;
  code?: string;
  name?: string;
  [k: string]: unknown;
}

const ENDPOINT = '/api_provinces';

const cache = new Map<string, ProvinceOption[]>();
const inFlight = new Map<string, Promise<ProvinceOption[]>>();

function unwrap(raw: unknown): RawProvince[] {
  if (Array.isArray(raw)) return raw as RawProvince[];
  const r = raw as { data?: RawProvince[]; provinces?: RawProvince[] } | null;
  if (Array.isArray(r?.data)) return r!.data as RawProvince[];
  if (Array.isArray(r?.provinces)) return r!.provinces as RawProvince[];
  return [];
}

export const provinceService = {
  async list(country: string): Promise<ProvinceOption[]> {
    const iso = (country ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(iso)) return [];
    if (cache.has(iso)) return cache.get(iso)!;
    if (!inFlight.has(iso)) {
      const p = http<unknown>(ENDPOINT, { query: { country: iso } })
        .then((raw) => {
          const list = unwrap(raw)
            .map((r) => ({ code: String(r.code ?? '').trim(), name: String(r.name ?? '').trim() }))
            .filter((r) => r.code !== '' && r.code.toLowerCase() !== 'xx')
            .sort((a, b) => a.name.localeCompare(b.name));
          cache.set(iso, list);
          inFlight.delete(iso);
          return list;
        })
        .catch(() => {
          inFlight.delete(iso);
          return [];
        });
      inFlight.set(iso, p);
    }
    return inFlight.get(iso)!;
  },
};
