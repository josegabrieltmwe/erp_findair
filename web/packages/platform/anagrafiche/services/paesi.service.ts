import { http } from './http';
import { countriesFromPublic } from './publicCatalogs';

/**
 * Paesi (paesi_iso) — catálogo global de países. Alimenta los selectores de
 * país (id_paese_iso) de sedes y otros formularios.
 *
 * IMPORTANTE — estructura de paesi_iso: la tabla mezcla PAÍSES soberanos con
 * SUBENTIDADES (estados USA, provincias de Canadá, subdivisiones de GB como
 * Galles/Scozia). El discriminador es la columna ISO2:
 *   - País de primer nivel:  ISO2 IS NULL  → el código de 2 letras vive en `ISO`
 *     (IT, FR, DE, GB, US...). Es el valor que guardan las sedes en id_paese_iso.
 *   - Subentidad provincial: ISO2 poblado (AL=Alabama, WLS=Galles...). NO son
 *     países y NO deben aparecer en el selector de país.
 * Por eso el value del selector es `ISO` (no ISO2) y filtramos ISO2 IS NULL.
 *
 * Endpoint: /get-api-countries (Country_Controller, public_oauth): catálogo público de países soberanos activos, legible por
 * cualquier perfil (el partner no tiene `master_data` y /api_master_countries le daba 403). Se cachea en memoria.
 */
export interface PaeseOption {
  id: number;
  ISO?: string; // código de 2 letras del país (value de id_paese_iso)
  ISO2?: string | null; // poblado solo en subentidades provinciales
  nome?: string;
  nomeEN?: string;
  [k: string]: unknown;
}

const ENDPOINT = '/get-api-countries';

let cache: PaeseOption[] | null = null;
let inFlight: Promise<PaeseOption[]> | null = null;

async function fetchAll(): Promise<PaeseOption[]> {
  return countriesFromPublic(await http<unknown>(ENDPOINT));
}

export const paesiService = {
  /** Lista completa de países activos con ISO2, cacheada en memoria. */
  async list(): Promise<PaeseOption[]> {
    if (cache) return cache;
    if (!inFlight) {
      inFlight = fetchAll().then((rows) => {
        cache = rows;
        inFlight = null;
        return rows;
      });
    }
    return inFlight;
  },
};
