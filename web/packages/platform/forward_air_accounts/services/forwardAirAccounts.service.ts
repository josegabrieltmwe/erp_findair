import { http } from '../../anagrafiche/services/http';
import { ApiError } from '../../anagrafiche/services/api.types';

/**
 * Cuentas de Forward Air (LTL) por partner y entorno. Backend:
 * /api_admin_forward_air_accounts (Forward_Air_Accounts_Admin_Controller),
 * solo TMWE. api_user y api_password son de solo escritura: el backend nunca
 * los devuelve, solo has_user / has_password.
 */

export type ForwardAirEnvironment = 'sandbox' | 'production';
export type ForwardAirAuthStatus = 'pending' | 'received' | 'expired';

export interface ForwardAirAccount {
  id: number;
  partner_id: number;
  partner_name?: string | null;
  environment: ForwardAirEnvironment;
  account_alias: string;
  customer_id: string | null;
  bill_to_account: string | null;
  description: string | null;
  principale: 'S' | 'N';
  status: 'active' | 'inactive';
  authorization_status: ForwardAirAuthStatus;
  authorization_ref: string | null;
  authorization_received_at: string | null;
  authorization_expires_at: string | null;
  last_verified_at: string | null;
  has_user: boolean;
  has_password: boolean;
}

export interface ForwardAirAccountPayload {
  id?: number;
  partner_id?: number;
  environment?: ForwardAirEnvironment;
  account_alias?: string;
  /** Solo escritura. Vacío en update = sin cambios. */
  api_user?: string;
  /** Solo escritura. Vacío en update = sin cambios. */
  api_password?: string;
  customer_id?: string;
  bill_to_account?: string;
  description?: string;
  principale?: 'S' | 'N';
}

export interface ForwardAirAuthorizationPayload {
  id: number;
  authorization_status: ForwardAirAuthStatus;
  authorization_ref?: string;
  authorization_received_at?: string;
  authorization_expires_at?: string;
}

export interface ForwardAirCheck {
  checked: boolean;
  ok: boolean | null;
  error_code?: string;
  note?: string;
  upstream_error?: { kind?: string; http_status?: number; code?: string | null; message?: string };
}

export interface ForwardAirVerifyResult {
  user_password: ForwardAirCheck;
  customer_id: ForwardAirCheck;
  bill_to_account: ForwardAirCheck;
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: unknown;
  message?: string;
}

const ENDPOINT = '/api_admin_forward_air_accounts';

/** Códigos FORWARD_AIR_ACCOUNT_* del backend. */
export const FORWARD_AIR_ERROR_CODES = [
  'FORWARD_AIR_ACCOUNT_INVALID',
  'FORWARD_AIR_ACCOUNT_DUPLICATE',
  'FORWARD_AIR_ACCOUNT_NOT_FOUND',
  'FORWARD_AIR_ACCOUNT_IN_USE',
  'FORWARD_AIR_ACCOUNT_NOT_USABLE',
  'FORWARD_AIR_ACCOUNT_ENCRYPT_FAILED',
  'FORWARD_AIR_ACCOUNT_SAVE_FAILED',
  'FORWARD_AIR_ACCOUNT_VERIFY_RATE_LIMITED',
] as const;

/** Código FORWARD_AIR_ACCOUNT_* de un error, o null si es otro tipo de error. */
export function forwardAirErrorCode(e: unknown): string | null {
  if (e instanceof ApiError && e.code && (FORWARD_AIR_ERROR_CODES as readonly string[]).includes(e.code)) {
    return e.code;
  }
  return null;
}

function unwrap<T>(raw: Envelope<T> | undefined, fallback: string): T {
  if (!raw || raw.success === false || raw.data === undefined) {
    throw new Error(typeof raw?.message === 'string' && raw.message ? raw.message : fallback);
  }
  return raw.data;
}

export const forwardAirAccountsService = {
  async list(filters: { partner_id?: number | null; environment?: ForwardAirEnvironment | '' } = {}): Promise<ForwardAirAccount[]> {
    const query: Record<string, string> = {};
    if (filters.partner_id) query.partner_id = String(filters.partner_id);
    if (filters.environment) query.environment = filters.environment;
    const raw = await http<Envelope<ForwardAirAccount[]>>(ENDPOINT, { query });
    const data = unwrap(raw, 'Failed to load Forward Air accounts');
    return Array.isArray(data) ? data : [];
  },

  async create(payload: ForwardAirAccountPayload): Promise<ForwardAirAccount> {
    return unwrap(await http<Envelope<ForwardAirAccount>>(ENDPOINT, { method: 'POST', body: payload }), 'Create failed');
  },

  async update(payload: ForwardAirAccountPayload): Promise<ForwardAirAccount> {
    return unwrap(await http<Envelope<ForwardAirAccount>>(ENDPOINT, { method: 'PUT', body: payload }), 'Update failed');
  },

  async remove(id: number): Promise<void> {
    const raw = await http<Envelope<unknown>>(ENDPOINT, { method: 'DELETE', body: { id } });
    if (raw?.success === false) throw new Error(raw.message || 'Delete failed');
  },

  async setPrincipal(id: number): Promise<ForwardAirAccount> {
    return unwrap(
      await http<Envelope<ForwardAirAccount>>(ENDPOINT, { method: 'PUT', body: { action: 'set_principal', id } }),
      'Update failed',
    );
  },

  async setAuthorization(payload: ForwardAirAuthorizationPayload): Promise<ForwardAirAccount> {
    return unwrap(
      await http<Envelope<ForwardAirAccount>>(ENDPOINT, { method: 'PUT', body: { action: 'set_authorization', ...payload } }),
      'Update failed',
    );
  },

  async verify(id: number): Promise<ForwardAirVerifyResult> {
    return unwrap(
      await http<Envelope<ForwardAirVerifyResult>>(ENDPOINT, { method: 'POST', body: { action: 'verify', id } }),
      'Verify failed',
    );
  },
};

/** ¿La carta de autorización está recibida y no vencida a `today` (YYYY-MM-DD)? */
export function isAuthorizationCurrent(a: Pick<ForwardAirAccount, 'authorization_status' | 'authorization_expires_at'>, today: string): boolean {
  return a.authorization_status === 'received' && (!a.authorization_expires_at || a.authorization_expires_at >= today);
}

/** Una cuenta de production solo es utilizable con la carta vigente; sandbox siempre. */
export function isAccountUsable(a: ForwardAirAccount, today: string): boolean {
  return a.environment !== 'production' || isAuthorizationCurrent(a, today);
}
