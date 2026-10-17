import { http } from '../../anagrafiche/services/http';

/**
 * Good types admin (cargo_tipomerce). Réplica modern de la página legacy
 * cod_stmerc. PK natural = `sigla` (varchar), no `id`.
 *
 * Backend: /api_cargo_tipomerce (Web_Good_Type_Controller) — CRUD REST por sigla.
 *   GET                 lista localizada (get_all con label por idioma)
 *   GET  ?sigla=XXX     un registro
 *   POST                crear   { sigla, labelITA|ENG|SPA, ... }
 *   PUT                 actualizar (sigla en body)
 *   DELETE              soft-delete stato='O' (sigla en body)
 *
 * admin_only (sesión). Sin auditoría (la tabla no tiene columnas insert_ / modif_).
 */

export type Flag = 'S' | 'N';

/** Fila tal como la devuelve el listado localizado (get_all). */
export interface GoodType {
  sigla: string;
  sigla2: string | null;
  lista_base: Flag;
  dangerous_goods_supplement: Flag;
  dry_ice_goods_supplement: Flag;
  label: string;
  icon?: string | null;
  [k: string]: unknown;
}

/** Fila completa (GET ?sigla=) con las 3 labels crudas, para editar. */
export interface GoodTypeDetail {
  sigla: string;
  sigla2: string | null;
  lista_base: Flag;
  ordine: number | string | null;
  danggoods: Flag;
  dryice: Flag;
  labelITA: string | null;
  labelENG: string | null;
  labelSPA: string | null;
  stato: 'A' | 'O';
  [k: string]: unknown;
}

export interface GoodTypePayload {
  sigla: string;
  sigla2?: string;
  lista_base?: Flag;
  ordine?: number | string;
  danggoods?: Flag;
  dryice?: Flag;
  labelITA?: string;
  labelENG?: string;
  labelSPA?: string;
}

const BASE = '/api_cargo_tipomerce';

interface RawWrite {
  success?: boolean;
  error?: string;
  data?: unknown;
}

function assertOk(raw: RawWrite | undefined, fallback: string): void {
  if (raw?.success === false) throw new Error(raw.error || fallback);
}

/** Colapsa array / `{data}` en un array plano. */
function listOf<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const d = (raw as { data?: unknown })?.data;
  return Array.isArray(d) ? (d as T[]) : [];
}

export const goodTypesService = {
  /** Listado localizado (idioma del usuario) con iconos. */
  async list(): Promise<GoodType[]> {
    const raw = await http<unknown>(BASE);
    return listOf<GoodType>(raw);
  },

  /** Registro completo por sigla (3 labels crudas) para el diálogo de edición. */
  async getBySigla(sigla: string): Promise<GoodTypeDetail | null> {
    const raw = await http<{ data?: GoodTypeDetail }>(BASE, { query: { sigla } });
    return raw?.data ?? null;
  },

  async create(payload: GoodTypePayload): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'POST', body: payload });
    assertOk(raw, 'Creazione fallita');
  },

  async update(sigla: string, payload: Partial<GoodTypePayload>): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'PUT', body: { ...payload, sigla } });
    assertOk(raw, 'Aggiornamento fallito');
  },

  async remove(sigla: string): Promise<void> {
    const raw = await http<RawWrite>(BASE, { method: 'DELETE', body: { sigla } });
    assertOk(raw, 'Eliminazione fallita');
  },
};
