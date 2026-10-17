import { http } from '../../anagrafiche/services/http';

/**
 * WebCargo API credentials per origin country (TMWE admin).
 *
 * Backend: /api_admin_webcargo_key (Web_Webcargo_Key_Admin_Controller — hybrid auth).
 *
 * The API NEVER returns key1/key2 — only `has_key1` / `has_key2` flags. A
 * credential that gets rendered is a credential that ends up in a screenshot or
 * a support ticket. Sending an empty key on update means "leave it as it is".
 */

const ENDPOINT = 'api_admin_webcargo_key';

export interface WebcargoKey {
  id: number;
  iso_paese: string;
  id_anagrafica: number;
  /** Agent name, resolved server-side from anagrafiche. */
  anagrafica_nome?: string | null;
  trm1?: string | null;
  trm2?: string | null;
  trm3?: string | null;
  trm4?: string | null;
  trm5?: string | null;
  trm6?: string | null;
  trm7?: string | null;
  trm8?: string | null;
  trm9?: string | null;
  trm10?: string | null;
  b2b: 'S' | 'N';
  /** The account used by default for this country. Only one active per country. */
  principale: 'S' | 'N';
  partners?: string | null;
  stato: 'A' | 'O';
  /** Whether a credential is stored — never the credential itself. */
  has_key1?: number | boolean;
  has_key2?: number | boolean;
}

export interface WebcargoKeyPayload {
  id?: number;
  iso_paese?: string;
  id_anagrafica?: number;
  /** Leave empty on update to keep the stored credential. */
  key1?: string;
  key2?: string;
  b2b?: 'S' | 'N';
  principale?: 'S' | 'N';
  partners?: string | null;
  stato?: 'A' | 'O';
  [k: string]: unknown;
}

interface RawListResponse {
  success?: boolean;
  error?: string;
  data?: WebcargoKey[];
  total?: number;
}

interface RawWriteResponse {
  success?: boolean;
  error?: string;
  message?: string;
  /** Present when deleting the primary account of a country. */
  warning?: string | null;
  data?: WebcargoKey;
}

export const webcargoKeyService = {
  async list(includeDeleted = false, ownerId?: number): Promise<WebcargoKey[]> {
    const query: Record<string, number> = {};
    if (includeDeleted) query.include_deleted = 1;
    // Filtra a las claves cuyo dueño directo es ese partner (tab en la
    // ficha de anagrafica) — NO cubre delegaciones vía `partners`.
    if (ownerId) query.id_anagrafica = ownerId;
    const raw = await http<RawListResponse>(ENDPOINT, { query });
    if (raw?.success === false) throw new Error(raw.error || 'No se pudo cargar la lista');
    return raw?.data ?? [];
  },

  async get(id: number): Promise<WebcargoKey> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { query: { id } });
    if (raw?.success === false || !raw?.data) throw new Error(raw?.error || 'Credencial no encontrada');
    return raw.data;
  },

  async create(payload: WebcargoKeyPayload): Promise<WebcargoKey> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false || !raw?.data) throw new Error(raw?.error || 'No se pudo crear');
    return raw.data;
  },

  async update(payload: WebcargoKeyPayload): Promise<WebcargoKey> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'PUT', body: payload });
    if (raw?.success === false || !raw?.data) throw new Error(raw?.error || 'No se pudo actualizar');
    return raw.data;
  },

  /**
   * Soft-delete. Returns a warning when the deleted row was the country's
   * primary account: that origin silently falls back to the Italian account.
   */
  async remove(id: number): Promise<{ warning: string | null }> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(raw.error || 'No se pudo desactivar');
    return { warning: raw?.warning ?? null };
  },
};
