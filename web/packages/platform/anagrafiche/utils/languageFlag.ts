import { countryIsoToFlagEmoji } from './currencyCountry';

/**
 * Bandera (emoji) para un código de idioma ISO-3 del backend (Locale_Registry:
 * ITA/ENG/SPA/FRA/TED/…). El mapeo idioma→país usa el país cuya bandera
 * representa convencionalmente el idioma (ENG→GB, SPA→ES, POR→PT…).
 *
 * Reutiliza countryIsoToFlagEmoji (regional indicators, sin dependencias),
 * el mismo helper que usan monedas y países. Extiende el mapeo de 5 idiomas
 * de LanguageSwitcher a los ~12 idiomas del catálogo de contactos.
 */
const LANG_ISO3_TO_COUNTRY: Record<string, string> = {
  ITA: 'IT', // Italiano
  ENG: 'GB', // English
  SPA: 'ES', // Español
  FRA: 'FR', // Français
  TED: 'DE', // Deutsch (Tedesco)
  POR: 'PT', // Português
  OLA: 'NL', // Nederlands (Olandese)
  DAN: 'DK', // Dansk
  RUS: 'RU', // Русский
  ARB: 'SA', // العربية (Arabo → Arabia Saudí)
  CNS: 'CN', // 中文 (Cinese)
  VTN: 'VN', // Tiếng Việt (Vietnamita)
};

/** Emoji de bandera para un código de idioma ISO-3, o '' si no se conoce. */
export function languageIso3ToFlagEmoji(iso3?: string | null): string {
  const code = (iso3 ?? '').toUpperCase().trim();
  const country = LANG_ISO3_TO_COUNTRY[code];
  return country ? countryIsoToFlagEmoji(country) : '';
}
