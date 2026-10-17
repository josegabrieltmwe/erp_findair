import { http } from "./http";

/**
 * Resolve a site's country ISO + EU membership (legacy spedy_isopresa.php /
 * Iso_cee). Two modes:
 *   - bySede(id_sede): the site's country + EU flag
 *   - isCee(iso): just the EU flag for a country code
 *
 * Both results are memoised for the lifetime of the page — the EU membership
 * of a country doesn't change between requests.
 */
interface SedeIsoPayload {
  id_sede: number;
  iso: string;
  is_cee: boolean;
}

const ceeCache = new Map<string, boolean>();

export const sedeIsoService = {
  async bySede(id_sede: number): Promise<SedeIsoPayload | null> {
    if (!id_sede) return null;
    const r = await http<{ success: boolean; data?: SedeIsoPayload }>(
      "/api_sede_iso",
      {
        query: { id_sede },
      },
    );
    if (r.success && r.data) {
      if (r.data.iso) ceeCache.set(r.data.iso.toUpperCase(), r.data.is_cee);
      return r.data;
    }
    return null;
  },

  /** EU membership of a country code (memoised). Empty/unknown → false. */
  async isCee(iso: string): Promise<boolean> {
    const key = (iso || "").toUpperCase().trim();
    if (key === "") return false;
    const hit = ceeCache.get(key);
    if (hit !== undefined) return hit;
    const r = await http<{ success: boolean; data?: SedeIsoPayload }>(
      "/api_sede_iso",
      {
        query: { iso: key },
      },
    );
    const val = !!(r.success && r.data?.is_cee);
    ceeCache.set(key, val);
    return val;
  },
};
