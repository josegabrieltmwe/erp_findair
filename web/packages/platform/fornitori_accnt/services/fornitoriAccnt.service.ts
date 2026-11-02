import { http } from '../../anagrafiche/services/http';
import { errorText, type RawApiError } from '../../utils/apiError';

/**
 * Credenciales de courier por partner (`fornitori_accnt`) — paridad legacy
 * `forn_accounts.php`/`forn_accounts_ajax.php`. Es el modelo REAL consumido
 * en producción (Courier_Account_Resolver, Carrier_Eligibility_Model...),
 * distinto y sin relación con `service_credentials` (tabla sin uso real).
 *
 * A diferencia de los otros 3 tabs de credenciales (KLM/AF, WebCargo
 * Published, WebCargo Realtime), aquí el conjunto de campos relevantes
 * depende del courier elegido (`id_fornitore`) — ver COURIER_FIELD_MAP.
 *
 * Backend: /api_admin_fornitori_accnt (Fornitori_Accnt_Admin_Controller),
 * admin-only (TMWE). P52: la respuesta ya NO trae `pw` ni `chiave`, solo
 * `has_pw` / `has_chiave` (¿hay valor guardado?). Al editar, enviarlos vacíos
 * (o no enviarlos) conserva el guardado.
 */

export interface FornitoreAccnt {
  id: number;
  id_fornitore: number;
  id_partner: number;
  id_account: string;
  fornitore_nome?: string;
  customer?: string;
  user?: string;
  /** ¿Hay contraseña guardada? (el valor nunca se devuelve). */
  has_pw?: boolean;
  /** ¿Hay clave guardada? (el valor nunca se devuelve). */
  has_chiave?: boolean;
  iso?: string;
  sis_metrico?: string;
  valuta_fix_cod?: string;
  valuta_fix_ass?: string;
  note?: string;
  stato?: string;
  [k: string]: unknown;
}

export interface FornitoreAccntPayload {
  id?: number;
  id_fornitore: number;
  id_partner: number;
  id_account: string;
  customer?: string;
  user?: string;
  pw?: string;
  chiave?: string;
  iso?: string;
  sis_metrico?: string;
  valuta_fix_cod?: string;
  valuta_fix_ass?: string;
  note?: string;
}

interface RawListResponse {
  success?: boolean;
  data?: FornitoreAccnt[];
  total?: number;
  error?: RawApiError;
}

interface RawWriteResponse {
  success?: boolean;
  error?: RawApiError;
  id?: number;
}

const ENDPOINT = '/api_admin_fornitori_accnt';

/**
 * Couriers reales observados en producción (`id_fornitore`), con el campo
 * visible por courier — paridad legacy `$frnt_cmd`. El nombre NO se
 * hardcodea aquí: se resuelve en el componente contra `anagrafiche` (la
 * etiqueta hardcodeada del legacy para id=8 ("TNT IT") está obsoleta — hoy
 * es Fedex Express Italy S.r.l, ver finding en memoria de proyecto).
 */
export const COURIER_FIELD_MAP: Record<number, string[]> = {
  3: ['id_account', 'user', 'pw'], // DHL
  7: ['id_account', 'customer', 'user', 'pw', 'chiave'], // UPS
  5: ['id_account', 'pw', 'chiave'], // FedEx (histórico)
  8: ['id_account', 'customer', 'user', 'pw'], // Fedex Express Italy actual (id legacy "TNT IT")
  8107: ['id_account', 'customer', 'user', 'pw'], // TNT W Global Express
  3338: ['id_account', 'chiave'], // Palletways
  8023: ['id_account', 'customer', 'user', 'pw', 'chiave'], // MRW
  7401: ['id_account', 'customer', 'pw'], // DTDC
};

/** ids de courier conocidos, en el orden en que aparecen en el legacy. */
export const KNOWN_COURIER_IDS = [3, 7, 5, 8, 8107, 3338, 8023, 7401];

export function fieldsForCourier(idFornitore: number | null): string[] {
  if (!idFornitore) return [];
  return COURIER_FIELD_MAP[idFornitore] || ['id_account', 'customer', 'user', 'pw', 'chiave'];
}

/** ¿Tiene la cuenta guardado ese secreto? Solo se fía de `has_*` (el API no devuelve el valor). */
export function hasSecret(
  item: Pick<FornitoreAccnt, 'has_pw' | 'has_chiave'> | null | undefined,
  field: 'pw' | 'chiave',
): boolean {
  if (!item) return false;
  return (field === 'pw' ? item.has_pw : item.has_chiave) === true;
}

export const fornitoriAccntService = {
  async list(idPartner: number): Promise<FornitoreAccnt[]> {
    const raw = await http<RawListResponse>(ENDPOINT, { query: { id_partner: String(idPartner) } });
    if (raw?.success === false) throw new Error(errorText(raw.error, 'Failed to load accounts'));
    return Array.isArray(raw?.data) ? raw!.data : [];
  },

  async create(payload: FornitoreAccntPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'POST', body: payload });
    if (raw?.success === false) throw new Error(errorText(raw.error, 'Create failed'));
  },

  async update(payload: FornitoreAccntPayload): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'PUT', body: payload });
    if (raw?.success === false) throw new Error(errorText(raw.error, 'Update failed'));
  },

  async remove(id: number): Promise<void> {
    const raw = await http<RawWriteResponse>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(errorText(raw.error, 'Delete failed'));
  },
};
