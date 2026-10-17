/**
 * Mapeo código de moneda (ISO 4217) → país ISO 3166-1 alpha-2, para mostrar
 * la bandera del país en el autocomplete de divisas.
 *
 * Regla general ISO 4217: los 2 primeros caracteres del código de moneda son
 * el código de país (GBP→GB, CHF→CH, INR→IN, USD→US…). Las excepciones
 * (monedas supranacionales o sin país 1:1) se resuelven con el override.
 */
const CURRENCY_COUNTRY_OVERRIDE: Record<string, string> = {
  EUR: 'EU', // Eurozona (bandera de la UE)
  XAU: '', // Oro — sin bandera
  XAG: '', // Plata — sin bandera
  XDR: '', // DEG/SDR (FMI) — sin bandera
  XPF: 'PF', // Franco CFP
  XCD: '', // Dólar del Caribe Oriental (multipaís)
  XOF: '', // Franco CFA occidental (multipaís)
  XAF: '', // Franco CFA central (multipaís)
};

/**
 * Devuelve el código de país ISO alpha-2 para una moneda, o '' si no aplica.
 */
export function currencyToCountryIso(sigla?: string | null): string {
  const code = (sigla ?? '').toUpperCase().trim();
  if (code.length < 2) {
    return '';
  }
  if (code in CURRENCY_COUNTRY_OVERRIDE) {
    return CURRENCY_COUNTRY_OVERRIDE[code];
  }
  // Regla por defecto: primeros 2 caracteres = país.
  return code.slice(0, 2);
}

/**
 * Emoji de bandera para un código de país ISO alpha-2, usando los caracteres
 * "Regional Indicator Symbol" (U+1F1E6..U+1F1FF). No requiere assets ni
 * dependencias: el propio sistema operativo/fuente renderiza la bandera.
 * Devuelve '' si el código no es un país alpha-2 válido (p. ej. 'EU' → 🇪🇺 sí;
 * monedas supranacionales sin país → '').
 */
export function countryIsoToFlagEmoji(iso?: string | null): string {
  const code = (iso ?? '').toUpperCase().trim();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
    return '';
  }
  const A = 0x1f1e6; // Regional Indicator 'A'
  const first = A + (code.charCodeAt(0) - 65);
  const second = A + (code.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}

/** Atajo: emoji de bandera directamente desde el código de moneda. */
export function currencyToFlagEmoji(sigla?: string | null): string {
  return countryIsoToFlagEmoji(currencyToCountryIso(sigla));
}
