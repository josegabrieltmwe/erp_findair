import { http } from './http';

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
 * Endpoint: /api_master_countries (Paesi_Iso_Controller, hybrid auth). Pagina
 * (per_page máx 100); cargamos todas las páginas una vez y cacheamos.
 */
export interface PaeseOption {
  id: number;
  ISO?: string; // código de 2 letras del país (value de id_paese_iso)
  ISO2?: string | null; // poblado solo en subentidades provinciales
  nome?: string;
  nomeEN?: string;
  [k: string]: unknown;
}

const ENDPOINT = '/api_master_countries';
const PER_PAGE = 100;

interface PaginatedResponse {
  data?: PaeseOption[];
  pagination?: { total_pages?: number; page?: number };
}

let cache: PaeseOption[] | null = null;
let inFlight: Promise<PaeseOption[]> | null = null;

async function fetchAll(): Promise<PaeseOption[]> {
  const first = await http<PaginatedResponse>(ENDPOINT, { query: { per_page: PER_PAGE, page: 1 } });
  const rows: PaeseOption[] = Array.isArray(first?.data) ? [...first.data] : [];
  const totalPages = first?.pagination?.total_pages ?? 1;
  for (let page = 2; page <= totalPages; page++) {
    const res = await http<PaginatedResponse>(ENDPOINT, { query: { per_page: PER_PAGE, page } });
    if (Array.isArray(res?.data)) rows.push(...res.data);
  }
  // Solo PAÍSES soberanos de primer nivel: ISO2 vacío/null (su código de 2
  // letras vive en `ISO`). Descarta subentidades provinciales (ISO2 poblado:
  // estados USA, provincias, subdivisiones GB). Requiere un `ISO` de 2 letras.
  return rows
    .filter((p) => {
      const iso2 = p.ISO2 == null ? '' : String(p.ISO2).trim();
      const iso = String(p.ISO ?? '').trim();
      return iso2 === '' && /^[A-Za-z]{2}$/.test(iso);
    })
    .sort((a, b) => String(a.nome ?? '').localeCompare(String(b.nome ?? '')));
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
