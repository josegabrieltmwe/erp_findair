import { http } from '../../anagrafiche/services/http';
import { ApiError } from '../../anagrafiche/services/api.types';

/**
 * Pasarelas de pago. Tres puertas de `tmwe_api`:
 *  - `payGatewayAccounts`: el partner gestiona SUS cuentas (/api_pay_gateway_accounts). El partner sale del token;
 *    el cliente nunca envía su id y una cuenta ajena responde 404.
 *  - `payGatewayAccountsAdmin`: TMWE consulta las de cualquier partner (/api_admin_pay_gateway_accounts), solo lectura.
 *  - `payRefunds`: solicitud y aprobación de reembolsos (/api_pay_refunds).
 * `secret` y `webhook_secret` son de solo escritura: la API devuelve `secret_hint` (últimos 4) y `has_webhook_secret`,
 * nunca el valor. Los ids son públicos (`pga_…`, `prf_…`).
 */

export const PAY_PROVIDERS = ['stripe'] as const;
export type PayProvider = (typeof PAY_PROVIDERS)[number];
export type PayEnvironment = 'production' | 'sandbox';
export const PAY_METHODS = ['card', 'sepa_debit', 'bank_transfer', 'paypal', 'satispay'] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
export type PayAccountStatus = 'active' | 'disabled' | 'invalid';

export interface PayGatewayAccount {
  /** Id público `pga_…`. */
  public_id: string;
  partner_id: number;
  provider: PayProvider;
  environment: PayEnvironment;
  account_alias: string;
  /** Últimos 4 caracteres del secreto. */
  secret_hint: string | null;
  public_key: string | null;
  provider_account_ref: string | null;
  /** Lista separada por comas. */
  enabled_methods: string;
  principale: 'S' | 'N';
  status: PayAccountStatus;
  has_webhook_secret: boolean | number | string;
  last_verified_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Solo en la vista de administración. */
  partner_name?: string | null;
}

export interface PayGatewayAccountCreate {
  provider: PayProvider;
  environment: PayEnvironment;
  account_alias: string;
  secret: string;
  webhook_secret?: string;
  public_key?: string;
  enabled_methods?: PayMethod[];
}

export interface PayGatewayAccountUpdate {
  id: string;
  account_alias?: string;
  enabled_methods?: PayMethod[];
  public_key?: string;
  status?: PayAccountStatus;
}

export interface PayRefund {
  /** Id público `prf_…`. */
  id: string;
  status: 'awaiting_approval' | 'pending' | 'succeeded' | 'failed' | 'canceled';
  amount_minor: number;
  reason: PayRefundReason;
  requested_by: number;
  approved_by: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export const PAY_REFUND_REASONS = ['requested_by_customer', 'duplicate', 'fraudulent', 'surcharge_waived', 'other'] as const;
export type PayRefundReason = (typeof PAY_REFUND_REASONS)[number];

export interface PayRefundRequest {
  /** Id público del pago `pay_…`. */
  payment_id: string;
  /** Importe decimal en la divisa del pago, p. ej. "12.50". */
  amount: string;
  currency?: string;
  reason: PayRefundReason;
  idempotency_key: string;
}

export interface PayRefundCreated {
  refund: PayRefund;
  /** true = HTTP 202: espera a que otra persona lo apruebe. */
  awaiting_approval: boolean;
  replayed: boolean;
}

/** Cuota cuyo cobro se revirtió y sigue cerrada: una persona decide si la reabre. */
export interface PayInstallmentReview {
  payment_id: number;
  installment_id: number;
  amount_minor: number;
  reversed_at: string | null;
  payment_public_id: string;
  partner_id: number;
  payment_status: string;
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: string | { message?: string; code?: string };
  message?: string;
  awaiting_approval?: boolean;
  replayed?: boolean;
}

function errorText(raw: Envelope<unknown> | undefined, fallback: string): string {
  const e = raw?.error;
  if (typeof e === 'string' && e) return e;
  if (e && typeof e === 'object' && e.message) return e.message;
  return fallback;
}

function unwrap<T>(raw: Envelope<T> | undefined, fallback: string): T {
  if (!raw || raw.success === false) throw new Error(errorText(raw, fallback));
  return raw.data as T;
}

/** Errores por campo que devuelve el backend (`error.details.fields`), si los hay. */
export function payFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  const body = err.details as { error?: { details?: { fields?: unknown } } } | undefined;
  const fields = body?.error?.details?.fields;
  if (!fields || typeof fields !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
    out[k] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}

/** Métodos habilitados como lista. */
export function enabledMethods(account: Pick<PayGatewayAccount, 'enabled_methods'>): string[] {
  return String(account.enabled_methods || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

/** La API devuelve los booleanos de MySQL como 0/1 o "0"/"1". */
export function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === '1';
}

const ACCOUNTS = '/api_pay_gateway_accounts';
const ADMIN_ACCOUNTS = '/api_admin_pay_gateway_accounts';
const REFUNDS = '/api_pay_refunds';

export const payGatewayAccounts = {
  async list(environment?: PayEnvironment): Promise<PayGatewayAccount[]> {
    const query: Record<string, string> = {};
    if (environment) query.environment = environment;
    const raw = await http<Envelope<PayGatewayAccount[]>>(ACCOUNTS, { query });
    return unwrap(raw, 'No se pudieron cargar las cuentas') ?? [];
  },

  async create(payload: PayGatewayAccountCreate): Promise<PayGatewayAccount> {
    const raw = await http<Envelope<PayGatewayAccount>>(ACCOUNTS, { method: 'POST', body: payload });
    return unwrap(raw, 'No se pudo crear la cuenta');
  },

  async update(payload: PayGatewayAccountUpdate): Promise<PayGatewayAccount> {
    const raw = await http<Envelope<PayGatewayAccount>>(ACCOUNTS, { method: 'PUT', body: payload });
    return unwrap(raw, 'No se pudo guardar la cuenta');
  },

  /** Vacío = no cambia. Al menos uno de los dos. */
  async rotateSecret(id: string, secrets: { secret?: string; webhook_secret?: string }): Promise<PayGatewayAccount> {
    const body: Record<string, string> = { action: 'rotate_secret', id };
    if (secrets.secret) body.secret = secrets.secret;
    if (secrets.webhook_secret) body.webhook_secret = secrets.webhook_secret;
    const raw = await http<Envelope<PayGatewayAccount>>(ACCOUNTS, { method: 'POST', body });
    return unwrap(raw, 'No se pudo rotar el secreto');
  },

  /** Comprueba las credenciales contra el proveedor (la API limita a una por cuenta cada 30 s). */
  async validate(id: string): Promise<PayGatewayAccount> {
    const raw = await http<Envelope<PayGatewayAccount>>(ACCOUNTS, { method: 'POST', body: { action: 'validate', id } });
    return unwrap(raw, 'La validación ha fallado');
  },

  async setPrincipal(id: string): Promise<PayGatewayAccount> {
    const raw = await http<Envelope<PayGatewayAccount>>(ACCOUNTS, { method: 'PUT', body: { action: 'set_principal', id } });
    return unwrap(raw, 'No se pudo marcar como principal');
  },

  async remove(id: string): Promise<void> {
    const raw = await http<Envelope<unknown>>(ACCOUNTS, { method: 'DELETE', body: { id } });
    unwrap(raw, 'No se pudo eliminar la cuenta');
  },
};

export const payGatewayAccountsAdmin = {
  async list(filters: { partnerId?: number | null; environment?: string; provider?: string; status?: string } = {}): Promise<PayGatewayAccount[]> {
    const query: Record<string, string | number> = {};
    if (filters.partnerId) query.partner_id = filters.partnerId;
    if (filters.environment) query.environment = filters.environment;
    if (filters.provider) query.provider = filters.provider;
    if (filters.status) query.status = filters.status;
    const raw = await http<Envelope<PayGatewayAccount[]>>(ADMIN_ACCOUNTS, { query });
    return unwrap(raw, 'No se pudieron cargar las cuentas') ?? [];
  },
};

export const payRefunds = {
  async listAwaitingApproval(): Promise<PayRefund[]> {
    const raw = await http<Envelope<PayRefund[]>>(REFUNDS, { query: { view: 'awaiting_approval' } });
    return unwrap(raw, 'No se pudieron cargar los reembolsos') ?? [];
  },

  async get(id: string): Promise<PayRefund> {
    const raw = await http<Envelope<PayRefund>>(REFUNDS, { query: { id } });
    return unwrap(raw, 'No se pudo cargar el reembolso');
  },

  async installmentsReview(): Promise<PayInstallmentReview[]> {
    const raw = await http<Envelope<PayInstallmentReview[]>>(REFUNDS, { query: { view: 'installments_review' } });
    return unwrap(raw, 'No se pudieron cargar las cuotas') ?? [];
  },

  /** 201 hecho, 202 espera aprobación (`awaiting_approval`). */
  async request(payload: PayRefundRequest): Promise<PayRefundCreated> {
    const raw = await http<Envelope<PayRefund>>(REFUNDS, { method: 'POST', body: payload });
    return {
      refund: unwrap(raw, 'No se pudo solicitar el reembolso'),
      awaiting_approval: raw?.awaiting_approval === true,
      replayed: raw?.replayed === true,
    };
  },

  /** Otra persona distinta de quien lo pidió; la API lo exige. */
  async approve(id: string): Promise<PayRefund> {
    const raw = await http<Envelope<PayRefund>>(REFUNDS, { method: 'POST', body: { action: 'approve', id } });
    return unwrap(raw, 'No se pudo aprobar el reembolso');
  },

  async reject(id: string): Promise<PayRefund> {
    const raw = await http<Envelope<PayRefund>>(REFUNDS, { method: 'POST', body: { action: 'reject', id } });
    return unwrap(raw, 'No se pudo rechazar el reembolso');
  },
};
