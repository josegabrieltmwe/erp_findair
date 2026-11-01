import type { CurrencyOption } from './currencies.service';
import type { PaeseOption } from './paesi.service';

/**
 * Adaptadores de los catálogos PÚBLICOS del backend (`get-api-countries`, `get-api-currencies`).
 * Cualquier perfil con sesión los puede leer; `api_master_countries` / `api_master_currencies` exigen el
 * módulo `master_data`, restringido a internos, y dejaban vacíos los desplegables del partner (403).
 */

interface RawCountry {
  iso?: unknown;
  nome?: unknown;
  name?: unknown;
}

interface RawCurrency {
  id?: unknown;
  sigla?: unknown;
  nome?: unknown;
  [k: string]: unknown;
}

function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as { data?: unknown; items?: unknown } | null;
  if (Array.isArray(r?.data)) return r!.data as T[];
  if (Array.isArray(r?.items)) return r!.items as T[];
  return [];
}

/** El catálogo ya trae solo países soberanos activos; se exige un `iso` de 2 letras y se ordena por nombre. */
export function countriesFromPublic(raw: unknown): PaeseOption[] {
  return asList<RawCountry>(raw)
    .map((c) => ({ iso: String(c.iso ?? '').trim(), nome: String(c.nome ?? ''), name: String(c.name ?? '') }))
    .filter((c) => /^[A-Za-z]{2}$/.test(c.iso))
    .map((c, i) => ({
      id: i + 1, // el catálogo público no publica el id; ningún selector lo usa (el valor es ISO)
      ISO: c.iso.toUpperCase(),
      ISO2: null,
      nome: c.nome || c.name,
      nomeEN: c.name || c.nome,
    }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

/** Monedas con id numérico (FK `valute.id`) ordenadas por sigla; se descarta el marcador 'AAA' del legacy. */
export function currenciesFromPublic(raw: unknown): CurrencyOption[] {
  return asList<RawCurrency>(raw)
    .map((c) => ({ ...c, id: Number(c.id), sigla: String(c.sigla ?? ''), nome: c.nome == null ? undefined : String(c.nome) }))
    .filter((c) => c.sigla !== '' && c.sigla !== 'AAA' && Number.isFinite(c.id) && c.id > 0)
    .sort((a, b) => a.sigla.localeCompare(b.sigla)) as CurrencyOption[];
}
