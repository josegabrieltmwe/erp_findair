import { http } from '../../anagrafiche/services/http';
import { ApiError } from '../../anagrafiche/services/api.types';

/**
 * Pasarelas de pago. Cinco puertas de `tmwe_api`:
 *  - `payGatewayAccounts`: el partner gestiona SUS cuentas (/api_pay_gateway_accounts). El partner sale del token;
 *    el cliente nunca envía su id y una cuenta ajena responde 404.
 *  - `payGatewayAccountsAdmin`: TMWE consulta las de cualquier partner (/api_admin_pay_gateway_accounts), solo lectura.
 *  - `payRefunds`: solicitud y aprobación de reembolsos (/api_pay_refunds).
 *  - `payPayments`: cobro de facturas con Checkout alojado de Stripe (/api_pay_payments). Nunca hay `client_secret`:
 *    el pago se completa en la página de la pasarela (`checkout_url`) y la autoridad del estado es el webhook.
 *  - `payPendingInvoices`: lista de facturas pendientes de cobro (/api_pay_pending_invoices), solo lectura. Punto de
 *    partida de la pantalla «Facturas pendientes de cobro»; el pago de cada fila reutiliza `payPayments.create`.
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

/**
 * Estado de un cobro online. Lista abierta (`string`) a propósito: el contrato fija los estados terminales que la SPA
 * necesita distinguir, pero la API puede añadir intermedios sin romper la pantalla.
 */
export type PayPaymentStatus = 'pending' | 'requires_action' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'expired' | (string & {});

/** Cobro online (`pay_…`). Solo `id` y `status` están garantizados; el resto depende del estado. */
export interface PayPayment {
  /** Id público `pay_…`. */
  id: string;
  status: PayPaymentStatus;
  /** Página de pago alojada de Stripe; solo en el alta (202) y mientras la sesión sigue abierta. */
  checkout_url?: string | null;
  /** Caducidad de la sesión de Checkout (ISO 8601). */
  expires_at?: string | null;
  invoice_id?: number | string | null;
  amount_minor?: number | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Alta de un cobro con tarjeta en modo alojado. `return_to` y `flow` los fija el servicio, no la pantalla. */
export interface PayPaymentCreate {
  invoice_id: number;
  /** Texto decimal con 2 decimales ("12.50"). Sin importe = todo lo pendiente de la factura. */
  amount?: string;
  currency?: string;
  /** Una por intento: repetir la misma petición con la misma clave devuelve el mismo cobro (`replayed`). */
  idempotency_key: string;
}

export interface PayPaymentCreated {
  payment: PayPayment;
  /** true = la clave ya se había usado con esta misma petición y se devuelve el cobro existente. */
  replayed: boolean;
  /** true = HTTP 201: la factura ya estaba cobrada y no hay página de pago que abrir. */
  alreadyPaid: boolean;
}

/** Filtros del listado paginado de cobros. */
export interface PayPaymentFilters {
  invoiceId?: number;
  status?: string;
}

/** Motivo por el que una factura pendiente no se puede cobrar online ahora (`not_payable_reason`). */
export type PayNotPayableReason = 'CURRENCY_NOT_SUPPORTED' | 'PAYMENT_IN_PROGRESS' | (string & {});

/**
 * Fila de `GET api_pay_pending_invoices`. Los importes (`total`, `pending`, `in_progress_amount`) llegan como TEXTO
 * decimal con 2 decimales, nunca como número JSON: se conservan así y solo se convierten para mostrar o comparar.
 * Las fechas son `AAAA-MM-DD`. No hay sede ni datos internos del partner.
 */
export interface PendingInvoice {
  /** Id de la factura: es el `invoice_id` del alta de cobro (`payPayments.create`). */
  invoice_id: number;
  number: number | string;
  invoice_date: string | null;
  /** Primer vencimiento abierto; `null` si ninguna cuota tiene fecha. */
  due_date: string | null;
  /** `due_date` anterior a hoy según la fecha del servidor. */
  overdue: boolean;
  currency: string;
  total: string;
  /** Suma de las cuotas de cobro abiertas. */
  pending: string;
  /** Hay un pago en vuelo o cobrado aún sin repartir entre las cuotas. */
  in_progress: boolean;
  in_progress_amount: string;
  /** Se puede iniciar un cobro con tarjeta ahora. */
  payable: boolean;
  /** `null` si `payable`; si no, el motivo. */
  not_payable_reason: PayNotPayableReason | null;
}

/** Página de facturas pendientes con la paginación que devuelve la API. */
export interface PendingInvoicesPage {
  rows: PendingInvoice[];
  total: number;
  page: number;
  perPage: number;
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: string | { message?: string; code?: string };
  message?: string;
  awaiting_approval?: boolean;
  replayed?: boolean;
  /** Paginación (solo en los listados que la devuelven, p. ej. `api_pay_pending_invoices`). */
  total?: number;
  page?: number;
  per_page?: number;
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
const PAYMENTS = '/api_pay_payments';
const PENDING_INVOICES = '/api_pay_pending_invoices';

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

/**
 * Cobro de facturas con Checkout alojado (scopes `payment_gateways:read` / `:write`).
 * Errores: 402 rechazo, 409 (clave repetida con otra petición / nada pendiente / factura ocupada), 422 validación y
 * 503 `PAYMENT_GATEWAYS_NOT_ACTIVE` llegan como `ApiError` con su estado; `classifyPayError` (payOnlineModel) los agrupa.
 */
export const payPayments = {
  /** Listado paginado de cobros, por factura y/o estado. */
  async list(filters: PayPaymentFilters = {}): Promise<PayPayment[]> {
    const query: Record<string, string | number> = {};
    if (filters.invoiceId) query.invoice_id = filters.invoiceId;
    if (filters.status) query.status = filters.status;
    const raw = await http<Envelope<PayPayment[]>>(PAYMENTS, { query });
    return unwrap(raw, 'No se pudieron cargar los cobros') ?? [];
  },

  /** Detalle por id público (`?id=pay_…`). Es lo que se consulta para refrescar el estado tras abrir Checkout. */
  async get(id: string): Promise<PayPayment> {
    const raw = await http<Envelope<PayPayment>>(PAYMENTS, { query: { id } });
    return unwrap(raw, 'No se pudo cargar el cobro');
  },

  /**
   * Inicia el cobro: 202 con `checkout_url`, o 201 si ya estaba cobrado (`alreadyPaid`). El servicio fija
   * `method: 'card'`, `return_to: 'erp'` y `flow: 'hosted'`; el cliente nunca elige el partner (sale del token).
   */
  async create(payload: PayPaymentCreate): Promise<PayPaymentCreated> {
    const body: Record<string, unknown> = {
      invoice_id: payload.invoice_id,
      method: 'card',
      idempotency_key: payload.idempotency_key,
      return_to: 'erp',
      flow: 'hosted',
    };
    if (payload.amount) body.amount = payload.amount;
    if (payload.currency) body.currency = payload.currency;
    const raw = await http<Envelope<PayPayment>>(PAYMENTS, { method: 'POST', body });
    const payment = unwrap(raw, 'No se pudo iniciar el cobro');
    return { payment, replayed: raw?.replayed === true, alreadyPaid: !payment.checkout_url && payment.status === 'succeeded' };
  },
};

/** Tipo de fallo de la lista de facturas pendientes, para elegir el mensaje de la pantalla. */
export type PendingInvoicesErrorKind = 'forbidden' | 'unavailable' | 'other';

/**
 * Agrupa los errores de `api_pay_pending_invoices`: 403 (falta `invoices:read` o `payment_gateways:read`, o el token no
 * identifica al partner) y 503 `PAYMENT_PENDING_UNAVAILABLE` (fallo de lectura). Que el 503 sea un error y no una lista
 * vacía es lo que impide decirle a la persona «no hay nada pendiente» cuando en realidad no se pudo consultar.
 * Cualquier otro caso (red, 5xx genérico, no-ApiError) es `other`.
 */
export function classifyPendingInvoicesError(err: unknown): PendingInvoicesErrorKind {
  if (!(err instanceof ApiError)) return 'other';
  if (err.status === 403) return 'forbidden';
  if (err.status === 503) return 'unavailable';
  return 'other';
}

/**
 * Facturas pendientes de cobro (scopes `invoices:read` + `payment_gateways:read` para personal y partner; sin scopes
 * nuevos). Solo lectura. El cliente/partner sale del token: la petición no admite ningún filtro por cliente, partner o
 * factura, por eso no se envía ninguno. Errores 403 y 503: ver `classifyPendingInvoicesError`.
 */
export const payPendingInvoices = {
  /**
   * Una página de facturas pendientes, ordenadas por vencimiento (la más próxima primero; sin fecha, al final).
   *
   * @param page    número de página (desde 1); la API vuelve a 1 si no es válido
   * @param perPage filas por página (máximo 100 en la API)
   */
  async list(page = 1, perPage = 25): Promise<PendingInvoicesPage> {
    const raw = await http<Envelope<PendingInvoice[]>>(PENDING_INVOICES, { query: { page, per_page: perPage } });
    const rows = unwrap(raw, 'No se pudieron cargar las facturas pendientes') ?? [];
    return { rows, total: Number(raw?.total ?? rows.length), page: Number(raw?.page ?? page), perPage: Number(raw?.per_page ?? perPage) };
  },
};
