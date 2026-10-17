import { http } from './http';

/**
 * Option sources for the contatti form selects. Both underlying api_ endpoints
 * are OAuth-only; these hit the hybrid Web_ wrappers so the session-based SPA
 * can load them (see routes/anagrafica.yml: api_contact_types_web /
 * api_i18n_languages_web).
 */
export interface ContactTypeOption {
  id: number;
  label: string;
  [k: string]: unknown;
}

export interface LanguageOption {
  code: string;
  name?: string;
  native?: string;
  [k: string]: unknown;
}

const CONTACT_TYPES_ENDPOINT = '/api_contact_types_web';
const LANGUAGES_ENDPOINT = '/api_i18n_languages_web';

function unwrapList<T>(raw: unknown): T[] {
  const r = raw as { data?: T[]; items?: T[] } | null;
  if (Array.isArray(r?.data)) return r!.data as T[];
  if (Array.isArray(r?.items)) return r!.items as T[];
  return [];
}

export const contactOptionsService = {
  async contactTypes(): Promise<ContactTypeOption[]> {
    try {
      const raw = await http<unknown>(CONTACT_TYPES_ENDPOINT, {});
      return unwrapList<ContactTypeOption>(raw)
        .map((r) => ({ ...r, id: Number(r.id) }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label)));
    } catch {
      return [];
    }
  },

  async languages(): Promise<LanguageOption[]> {
    try {
      const raw = await http<unknown>(LANGUAGES_ENDPOINT, {});
      return unwrapList<LanguageOption>(raw);
    } catch {
      return [];
    }
  },
};
