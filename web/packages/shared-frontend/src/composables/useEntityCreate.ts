import { ref, type Ref } from 'vue';
import type { $Fetch } from 'ofetch';

/**
 * useEntityCreate — shared "create a draft entity" flow for the express SPAs.
 *
 * Cargo and shipment creation are mechanically identical: POST a payload to a
 * unified CRUD endpoint and read back the new id. Only three things vary — the
 * endpoint, the http instance (each app has its own basePath) and the key under
 * which the backend returns the id (cargo → `shipment_id`, express → `id`).
 * Everything else (loading flag, response unwrapping, error surfacing) lives
 * here ONCE so neither store reimplements it.
 *
 * The id is read defensively from either `res.data[idKey]` (unified CRUD shape)
 * or `res[idKey]` (flat shape), so the same composable fits both endpoints.
 */
export interface EntityCreateOptions {
  /** App http instance (createHttpClient) — carries the per-app basePath. */
  http: $Fetch;
  /** Unified CRUD endpoint, e.g. '/unified_cargo_shipment' | '/unified_shipment'. */
  endpoint: string;
  /** Key holding the new id in the response. Default 'id'. */
  idKey?: string;
  /** Optional error sink (e.g. a toast). Receives a human-readable message. */
  onError?: (message: string) => void;
}

export interface EntityCreateApi<TPayload> {
  /** True while a create request is in flight. */
  saving: Ref<boolean>;
  /** POST the payload; resolves to the new id, or null on failure. */
  create: (payload: TPayload) => Promise<number | null>;
}

function extractId(res: unknown, idKey: string): number | null {
  if (!res || typeof res !== 'object') return null;
  const o = res as Record<string, unknown> & { data?: Record<string, unknown> };
  const raw = o.data && idKey in o.data ? o.data[idKey] : o[idKey];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function useEntityCreate<TPayload extends Record<string, unknown>>(
  opts: EntityCreateOptions,
): EntityCreateApi<TPayload> {
  const idKey = opts.idKey ?? 'id';
  const saving = ref(false);

  async function create(payload: TPayload): Promise<number | null> {
    saving.value = true;
    try {
      const res = await opts.http(opts.endpoint, { method: 'POST', body: payload });
      const id = extractId(res, idKey);
      if (id === null) {
        const msg =
          (res as { error?: string })?.error ?? 'Creation failed: no id returned';
        opts.onError?.(msg);
      }
      return id;
    } catch (err) {
      opts.onError?.((err as Error).message || 'Creation failed');
      return null;
    } finally {
      saving.value = false;
    }
  }

  return { saving, create };
}

/**
 * Minimal anagrafica shape both express SPAs return from their (identical)
 * anagrafica service. Only the fields used to build a human label.
 */
export interface ClientLike {
  id: number | string;
  rag_soc?: string | null;
  nome_breve?: string | null;
  pi_cf?: string | null;
  citta?: string | null;
  prov?: string | null;
}

export interface ClientOption {
  id: number;
  label: string;
}

/**
 * Build a never-empty, human-readable label for a client option used by the
 * EntityNewPage autocomplete. The DB frequently stores an empty `rag_soc`, so
 * a naive `rag_soc ?? '#id'` would yield a blank title (the autocomplete then
 * shows the raw id / nothing). We fall back through nome_breve → pi_cf → city
 * → '#id', and always suffix the id so options stay distinguishable.
 */
export function toClientOptions(rows: ClientLike[]): ClientOption[] {
  return rows
    .filter((a) => Number(a.id) > 0)
    .map((a) => {
      const id = Number(a.id);
      const name =
        nonEmpty(a.rag_soc) ??
        nonEmpty(a.nome_breve) ??
        nonEmpty(a.pi_cf) ??
        nonEmpty(joinLoc(a.citta, a.prov));
      const label = name ? `${name} · #${id}` : `Cliente #${id}`;
      return { id, label };
    });
}

function nonEmpty(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  return s.length > 0 ? s : null;
}

function joinLoc(citta?: string | null, prov?: string | null): string | null {
  const parts = [citta, prov].map((p) => (p ?? '').trim()).filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}
