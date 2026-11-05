import type { PaeseOption } from '../services/paesi.service';

/**
 * Ordenación del selector de país por relevancia de la búsqueda.
 *
 * Sin filtro propio, Vuetify filtraba por subcadena y respetaba el orden del
 * catálogo (nombre italiano): «IT» mostraba antes Arabia Saudita, Vaticano o
 * Egipto que Italia y `auto-select-first` + Enter guardaba el primero (SA).
 *
 * Puntuación (menor = mejor):
 *   0 código ISO exacto · 1 código que empieza por · 2 nombre que empieza por
 *   3 nombre que contiene. Sin coincidencia → fuera de la lista.
 * Los nombres se comparan sin acentos ni mayúsculas, contra el nombre en el
 * idioma de la UI (Intl.DisplayNames), el inglés y el italiano del catálogo.
 */

export interface RankedCountry {
  iso: string;
  /** Nombre en el idioma de la UI. */
  name: string;
  score: number;
}

export function foldText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const displayNamesCache = new Map<string, Intl.DisplayNames | null>();

function displayNames(locale: string): Intl.DisplayNames | null {
  if (displayNamesCache.has(locale)) return displayNamesCache.get(locale)!;
  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    dn = null;
  }
  displayNamesCache.set(locale, dn);
  return dn;
}

/** Nombre del país en el idioma `locale`; fallback nomeEN y nome del catálogo. */
export function countryDisplayName(c: PaeseOption, locale: string): string {
  const iso = String(c.ISO ?? '').toUpperCase();
  let name = '';
  if (/^[A-Z]{2}$/.test(iso)) {
    try {
      const v = displayNames(locale)?.of(iso);
      // Para códigos desconocidos Intl devuelve el propio código.
      if (v && v !== iso) name = v;
    } catch {
      /* código no válido para Intl */
    }
  }
  return name || String(c.nomeEN ?? '') || String(c.nome ?? '') || iso;
}

export function rankCountries(
  countries: PaeseOption[],
  search: string | null | undefined,
  locale: string,
): RankedCountry[] {
  const q = foldText(search ?? '');
  const qIso = q.toUpperCase();
  const out: RankedCountry[] = [];
  for (const c of countries) {
    const iso = String(c.ISO ?? '').toUpperCase();
    if (!iso) continue;
    const name = countryDisplayName(c, locale);
    if (!q) {
      out.push({ iso, name, score: 0 });
      continue;
    }
    let score = -1;
    if (iso === qIso) score = 0;
    else if (iso.startsWith(qIso)) score = 1;
    else {
      const names = [name, String(c.nomeEN ?? ''), String(c.nome ?? '')]
        .filter(Boolean)
        .map(foldText);
      if (names.some((n) => n.startsWith(q))) score = 2;
      else if (names.some((n) => n.includes(q))) score = 3;
    }
    if (score >= 0) out.push({ iso, name, score });
  }
  const collator = new Intl.Collator(locale);
  out.sort((a, b) => a.score - b.score || collator.compare(a.name, b.name));
  return out;
}
