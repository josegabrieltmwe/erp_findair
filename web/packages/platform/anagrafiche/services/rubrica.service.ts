/**
 * Rubrica (address book) REST client — wraps the modern Rubrica_*
 * controllers in `controller/api/rubrica/`. Powers the autocomplete picker
 * that fills the address fields in one click (paridad legacy `rubrica.php`,
 * campo `anagr_cerca_*` de spedy_form / spedyc_form).
 *
 * Shared by shipment_express and cargo_express: the endpoint hits the same
 * `anagrafiche_rubrica` table for both, so the client lives here and each
 * app maps `RubricaRow` onto its own address shape (express uses English
 * field names, cargo uses the raw legacy column names).
 *
 * The http client is INJECTED rather than imported: each app resolves its
 * own basePath from a different global (`__TMWE_CARGO__` vs
 * `__TMWE_SHIPMENT__`), so a hard-coded import here would send one of them
 * to the wrong prefix.
 */

/**
 * Minimal shape of the per-app http client this service needs.
 * `body` is typed as a plain record (not `unknown`) so that ofetch's `$Fetch`
 * is assignable: its own `body` only accepts BodyInit | Record | null.
 */
export type RubricaHttp = <T>(
  url: string,
  options: { method: string; body?: Record<string, unknown> },
) => Promise<T>;

export interface RubricaRow {
  id: number;
  name: string;
  adress: string;
  address: string; // alias of adress (server normalizes it)
  city: string;
  prov?: string;
  cap?: string;
  tel?: string;
  contact_name?: string;
  country: string;
  country_name?: string;
  controllare?: "S" | "N";
  preferred?: "S" | "N";
}

export interface RubricaSearchParams {
  text: string;
  limit?: number;
  offset?: number;
  order_by?: string;
  order?: "ASC" | "DESC";
  /**
   * Anagrafica cuya rúbrica se busca (paridad legacy: el CLIENTE de la
   * expedición, no el operador). Solo se respeta en modo sesión; en OAuth el
   * backend lo ignora. Omitir → rúbrica del titular de sesión.
   */
  id_cliente?: number;
}

export interface RubricaService {
  search(p: RubricaSearchParams): Promise<RubricaRow[]>;
  add(payload: Partial<RubricaRow>): Promise<{ id: number; created: boolean }>;
  setPreferred(id: number, value: "S" | "N"): Promise<{ ok: boolean }>;
}

/** Build a rubrica client bound to the calling app's http instance. */
export function createRubricaService(http: RubricaHttp): RubricaService {
  return {
    /** POST /rubrica_search — full-text search in anagrafiche_rubrica. */
    search(p: RubricaSearchParams): Promise<RubricaRow[]> {
      return http<RubricaRow[]>("/rubrica_search", {
        method: "POST",
        body: {
          text: p.text,
          limit: p.limit ?? 20,
          offset: p.offset ?? 0,
          order_by: p.order_by ?? "r.preferito DESC, r.nome",
          order: p.order ?? "ASC",
          ...(p.id_cliente ? { id_cliente: p.id_cliente } : {}),
        },
      });
    },

    /** POST /rubrica_add — persist a new entry (with dedup). */
    add(
      payload: Partial<RubricaRow>,
    ): Promise<{ id: number; created: boolean }> {
      return http("/rubrica_add", {
        method: "POST",
        body: { ...payload } as Record<string, unknown>,
      });
    },

    /** POST /rubrica_set_preferred — toggle the "preferred" flag. */
    setPreferred(id: number, value: "S" | "N"): Promise<{ ok: boolean }> {
      return http("/rubrica_set_preferred", {
        method: "POST",
        body: { id, preferito: value },
      });
    },
  };
}
