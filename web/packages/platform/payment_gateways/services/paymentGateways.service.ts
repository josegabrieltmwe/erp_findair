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
 *  - `payAuthorizations`: autorizaciones de cobro de los clientes (/api_pay_authorizations): el permiso que firma el
 *    cliente una vez para que el vendedor le cobre después recargos. Alta por Checkout `setup` alojado, consulta y
 *    revocación. Al final del fichero, junto con sus tipos.
 *  - `paySurcharges`: recargos por sobrepeso, oversize u otros (/api_pay_surcharges): listar, proponer, avisar,
 *    impugnar en nombre del cliente y, solo con `payment_gateways:admin`, perdonar, rechazar una impugnación y cobrar.
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
  /** Resultado del cobro de un recargo (`charge` y `reject_dispute`). */
  result?: string;
  /** `waive`: true si el recargo ya estaba cobrado y se ha solicitado el reembolso. */
  refund_requested?: boolean;
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

// ---------------------------------------------------------------------------------------------------------------------
// Autorizaciones de cobro y recargos (Ola 3 / F-C). Contrato: docs/contrato-con-api.md y, en tmwe_api,
// docs/06-api/pasarelas_pago/README.md. TODO está apagado por defecto en el servidor (503 `PAYMENT_NOT_ACTIVE`): esta capa
// no activa nada, solo habla con la API. El partner y la persona salen SIEMPRE del token: ninguna llamada envía
// `partner_id`, y un recargo de otro partner responde 404 incluso a TMWE, por lo que no existe «vista cruzada».
// ---------------------------------------------------------------------------------------------------------------------

const AUTHORIZATIONS = '/api_pay_authorizations';
const SURCHARGES = '/api_pay_surcharges';

/** Estados de una autorización. `active` solo lo fija el webhook de la pasarela, nunca la SPA. */
export const PAY_AUTHORIZATION_STATUSES = ['pending', 'active', 'failed', 'revoked', 'expired'] as const;
export type PayAuthorizationStatus = (typeof PAY_AUTHORIZATION_STATUSES)[number];

/** Métodos de la autorización (D5): tarjeta por defecto o adeudo SEPA. Distinto de `PayMethod` (cuentas de pasarela). */
export const PAY_AUTHORIZATION_METHODS = ['card', 'sepa_debit'] as const;
export type PayAuthorizationMethod = (typeof PAY_AUTHORIZATION_METHODS)[number];

/**
 * Autorización de cobro (`pau_…`) tal como la ve el PERSONAL: la lista blanca del cliente más `customer_id`,
 * `failure_code` y `account_source`. Nunca llegan referencias del proveedor, cuenta de pasarela, IP ni user agent.
 * `checkout_url` y `expires_at` solo vienen en la respuesta del alta (`checkout_url` es `null` en un reintento).
 */
export interface PayAuthorization {
  /** Id público `pau_…`. */
  public_id: string;
  method_type: PayAuthorizationMethod;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  currency: string;
  /** Tope por cobro que el cliente aceptó, en céntimos. */
  max_charge_minor: number;
  /** Tope mensual que el cliente aceptó, en céntimos. */
  max_month_minor: number;
  notice_days: number;
  dispute_days: number;
  status: PayAuthorizationStatus;
  consent_text_version: string;
  consent_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
  /** Solo personal. */
  customer_id?: number;
  /** Nombre del cliente (nome_breve o razón social); vacío si no se resolvió. Solo en vistas del personal. */
  customer_name?: string;
  /** Solo personal. */
  failure_code?: string | null;
  /** Solo personal: `partner` (cuenta propia) o `tmwe_fallback`. */
  account_source?: 'partner' | 'tmwe_fallback' | string;
  /** Solo en la respuesta del alta, primer intento. */
  checkout_url?: string | null;
  expires_at?: string | null;
}

/** Texto de consentimiento vigente con las cifras del vendedor (D4) que la persona debe leer antes de aceptar. */
export interface PayConsentText {
  /** Versión del texto: el alta debe devolverla tal cual o responde 409 `CONSENT_TEXT_NOT_CURRENT`. */
  version: string;
  locale: string;
  body_hash: string;
  body: string;
  terms: {
    max_charge_minor: number;
    max_month_minor: number;
    notice_days: number;
    dispute_days: number;
    currency: string;
  };
}

/** Alta de una autorización en nombre de un cliente del partner (consentimiento presencial documentado). */
export interface PayAuthorizationCreate {
  customer_id: number;
  method: PayAuthorizationMethod;
  /** Versión del texto mostrado y su idioma (`es-ES`). `accepted` lo fija el servicio a `true` literal. */
  consentTextVersion: string;
  consentLocale: string;
  /** Una por intento (8-64 caracteres `A-Za-z0-9_-:`). */
  idempotency_key: string;
}

export interface PayAuthorizationCreated {
  authorization: PayAuthorization;
  /** true = 200: la clave ya se usó; el reintento NO trae `checkout_url`. */
  replayed: boolean;
}

/** Filtros del listado de autorizaciones (`customer_id` solo estrecha la cartera del propio partner). */
export interface PayAuthorizationFilters {
  status?: PayAuthorizationStatus;
  customerId?: number;
  page?: number;
  perPage?: number;
}

/** Página de resultados con la paginación que devuelve la API. */
export interface PayPage<T> {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
}

/** Tipos de recargo. */
export const PAY_SURCHARGE_TYPES = ['overweight', 'oversize', 'other'] as const;
export type PaySurchargeType = (typeof PAY_SURCHARGE_TYPES)[number];

/** Estados de un recargo. `disputed` = impugnado por el cliente (no se cobra hasta resolverlo). */
export const PAY_SURCHARGE_STATUSES = ['pending_notice', 'notified', 'charged', 'failed', 'disputed', 'waived', 'invoiced'] as const;
export type PaySurchargeStatus = (typeof PAY_SURCHARGE_STATUSES)[number];

/**
 * Recargo (`psu_…`) tal como lo ve el PERSONAL: la lista blanca del cliente más los datos del vendedor (sin ids
 * internos, versión ni huella de evidencia). Los campos de liquidación son internos del vendedor.
 */
export interface PaySurcharge {
  /** Id público `psu_…`. */
  public_id: string;
  surcharge_type: PaySurchargeType;
  declared_value: string | null;
  measured_value: string | null;
  carrier_ref: string | null;
  evidence: string;
  /** Importe en CÉNTIMOS (entero). */
  amount_minor: number;
  currency: string;
  status: PaySurchargeStatus;
  notified_at: string | null;
  /** Primer momento en que se puede cobrar (aviso + días de preaviso). */
  notice_due_at: string | null;
  /** Fin del plazo de impugnación. */
  dispute_until: string | null;
  disputed_at: string | null;
  disputed_reason: string | null;
  waived_reason: string | null;
  created_at: string | null;
  partner_id?: number;
  customer_id?: number;
  /** Nombre del cliente (nome_breve o razón social); vacío si no se resolvió. Solo en vistas del personal. */
  customer_name?: string;
  /** Cuenta que cobra: solo personal; nunca se muestra al cliente. */
  gateway_account_id?: number | null;
  account_source?: string | null;
  creditor_partner_id?: number;
  /** 1 si TMWE cobró como respaldo y debe transferir al partner. */
  settlement_required?: number | boolean;
  settled_at?: string | null;
}

/** Propuesta de recargo. El importe es un ENTERO en céntimos (un decimal se rechaza con 422). */
export interface PaySurchargePropose {
  customer_id: number;
  surcharge_type: PaySurchargeType;
  amount_minor: number;
  /** Obligatorios en `overweight` y `oversize`. */
  declared_value?: string;
  measured_value?: string;
  evidence: string;
  shipment_id?: number;
  carrier_ref?: string;
  /** `pau_…` opcional; por defecto, la autorización activa del cliente. */
  authorization?: string;
}

export interface PaySurchargeProposed {
  surcharge: PaySurcharge;
  /** true = 200: el mismo hecho (envío + tipo + evidencia) ya existía. */
  replayed: boolean;
}

/** Resultado del cobro de un recargo (`charge`) o de rechazar una impugnación (`reject_dispute`). */
export type PaySurchargeChargeResult = 'charged' | 'pending' | 'failed' | 'requires_invoice' | 'waiting' | (string & {});

export interface PaySurchargeActionResult {
  surcharge: PaySurcharge;
  /** Solo `charge` y `reject_dispute`. */
  result?: PaySurchargeChargeResult;
  /** Solo `waive`: se solicitó el reembolso porque ya estaba cobrado. */
  refundRequested?: boolean;
  replayed: boolean;
}

/** Filtros del listado de recargos. */
export interface PaySurchargeFilters {
  status?: PaySurchargeStatus;
  customerId?: number;
  page?: number;
  perPage?: number;
}

/** Acciones de un recargo que admiten motivo. */
export type PaySurchargeReasonAction = 'dispute' | 'waive';

function pageOf<T>(raw: Envelope<T[]> | undefined, rows: T[], page: number, perPage: number): PayPage<T> {
  return { rows, total: Number(raw?.total ?? rows.length), page: Number(raw?.page ?? page), perPage: Number(raw?.per_page ?? perPage) };
}

/**
 * Autorizaciones de cobro (scopes `payment_gateways:read` para leer y `:write` para dar de alta o revocar, sin scopes
 * nuevos). Errores relevantes (ver `classifySurchargeError`): 503 `PAYMENT_NOT_ACTIVE` (interruptor apagado),
 * 409 `CONSENT_TEXT_NOT_CURRENT` / `AUTHORIZATION_ALREADY_ACTIVE` / `PAYMENT_METHOD_NOT_AVAILABLE`, 404 cliente ajeno.
 * Revocar y leer funcionan siempre, aunque el interruptor esté apagado.
 */
export const payAuthorizations = {
  /** Texto de consentimiento vigente y cifras del vendedor. Idioma `es-ES` por defecto (formato `xx-XX`). */
  async consentText(locale = 'es-ES'): Promise<PayConsentText> {
    const raw = await http<Envelope<PayConsentText>>(AUTHORIZATIONS, { query: { view: 'consent_text', locale } });
    return unwrap(raw, 'No se pudo cargar el texto de consentimiento');
  },

  /** Listado paginado de las autorizaciones de la cartera del partner del token. */
  async list(filters: PayAuthorizationFilters = {}): Promise<PayPage<PayAuthorization>> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 25;
    const query: Record<string, string | number> = { page, per_page: perPage };
    if (filters.status) query.status = filters.status;
    if (filters.customerId) query.customer_id = filters.customerId;
    const raw = await http<Envelope<PayAuthorization[]>>(AUTHORIZATIONS, { query });
    return pageOf(raw, unwrap(raw, 'No se pudieron cargar las autorizaciones') ?? [], page, perPage);
  },

  /** Detalle por id público `pau_…`; es lo que se sondea tras abrir el Checkout hasta ver `active`. */
  async get(id: string): Promise<PayAuthorization> {
    const raw = await http<Envelope<PayAuthorization>>(AUTHORIZATIONS, { query: { id } });
    return unwrap(raw, 'No se pudo cargar la autorización');
  },

  /**
   * Alta en nombre de un cliente del partner (consentimiento presencial). Responde con `checkout_url` (página alojada
   * donde el cliente teclea la tarjeta o el IBAN: nada de eso toca el ERP ni TMWE). `return_to` lo fija el servicio a
   * `erp`; la IP/user agent/persona de la prueba del consentimiento los pone el servidor.
   */
  async create(payload: PayAuthorizationCreate): Promise<PayAuthorizationCreated> {
    const body = {
      customer_id: payload.customer_id,
      method: payload.method,
      consent: { text_version: payload.consentTextVersion, locale: payload.consentLocale, accepted: true },
      return_to: 'erp',
      idempotency_key: payload.idempotency_key,
    };
    const raw = await http<Envelope<PayAuthorization>>(AUTHORIZATIONS, { method: 'POST', body });
    return { authorization: unwrap(raw, 'No se pudo crear la autorización'), replayed: raw?.replayed === true };
  },

  /** Revoca una autorización (el cliente tiene derecho a retirarla; no mueve dinero). 409 si ya caducó o falló. */
  async revoke(id: string): Promise<PayAuthorization> {
    const raw = await http<Envelope<PayAuthorization>>(AUTHORIZATIONS, { method: 'POST', body: { action: 'revoke', id } });
    return unwrap(raw, 'No se pudo revocar la autorización');
  },
};

/**
 * Recargos. Lectura: `payment_gateways:read`. Proponer, avisar e impugnar en nombre del cliente: `:write`. Perdonar,
 * rechazar una impugnación y cobrar: `payment_gateways:admin` Y ser TMWE o `partner:manage` (la SPA solo decide si
 * muestra el botón; el API autoriza y responde 403 `PAYMENT_FORBIDDEN`). Un recargo de otro partner responde 404 incluso a
 * TMWE: no hay vista cruzada y esta capa nunca envía `partner_id`.
 */
export const paySurcharges = {
  /** Listado paginado de los recargos del partner del token, con filtros de estado y de cliente. */
  async list(filters: PaySurchargeFilters = {}): Promise<PayPage<PaySurcharge>> {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 25;
    const query: Record<string, string | number> = { page, per_page: perPage };
    if (filters.status) query.status = filters.status;
    if (filters.customerId) query.customer_id = filters.customerId;
    const raw = await http<Envelope<PaySurcharge[]>>(SURCHARGES, { query });
    return pageOf(raw, unwrap(raw, 'No se pudieron cargar los recargos') ?? [], page, perPage);
  },

  /** Recargos cobrados por TMWE como respaldo a favor del partner y aún sin transferir (máx. 100, sin paginar; solo datos). */
  async pendingTransfer(): Promise<PaySurcharge[]> {
    const raw = await http<Envelope<PaySurcharge[]>>(SURCHARGES, { query: { view: 'pending_transfer' } });
    return unwrap(raw, 'No se pudieron cargar los recargos pendientes de transferir') ?? [];
  },

  /** Detalle por id público `psu_…`. */
  async get(id: string): Promise<PaySurcharge> {
    const raw = await http<Envelope<PaySurcharge>>(SURCHARGES, { query: { id } });
    return unwrap(raw, 'No se pudo cargar el recargo');
  },

  /** Propone un recargo (`pending_notice`: aún no se avisa ni se cobra). 201 nuevo, 200 `replayed` si ya existía. */
  async propose(payload: PaySurchargePropose): Promise<PaySurchargeProposed> {
    const body: Record<string, unknown> = {
      customer_id: payload.customer_id,
      surcharge_type: payload.surcharge_type,
      amount: { amount_minor: payload.amount_minor, currency: 'EUR' },
      evidence: payload.evidence,
    };
    if (payload.declared_value) body.declared_value = payload.declared_value;
    if (payload.measured_value) body.measured_value = payload.measured_value;
    if (payload.shipment_id) body.shipment_id = payload.shipment_id;
    if (payload.carrier_ref) body.carrier_ref = payload.carrier_ref;
    if (payload.authorization) body.authorization = payload.authorization;
    const raw = await http<Envelope<PaySurcharge>>(SURCHARGES, { method: 'POST', body });
    return { surcharge: unwrap(raw, 'No se pudo proponer el recargo'), replayed: raw?.replayed === true };
  },

  /** Avisa al cliente: fija `notice_due_at` y `dispute_until`. Repetirlo no reinicia los plazos. */
  async notify(id: string): Promise<PaySurchargeActionResult> {
    return paySurchargeAction({ action: 'notify', id }, 'No se pudo avisar al cliente');
  },

  /** Impugna en nombre del cliente (con motivo) dentro de `dispute_until`. */
  async dispute(id: string, reason: string): Promise<PaySurchargeActionResult> {
    return paySurchargeAction({ action: 'dispute', id, reason }, 'No se pudo registrar la impugnación');
  },

  /** ADMIN. Perdona el recargo con motivo; si ya estaba cobrado se solicita el reembolso (`refundRequested`). */
  async waive(id: string, reason: string): Promise<PaySurchargeActionResult> {
    return paySurchargeAction({ action: 'waive', id, reason }, 'No se pudo perdonar el recargo');
  },

  /** ADMIN. Rechaza la impugnación: el recargo es válido; vuelve a `charged` sin cobrar dos veces, o se cobra si nunca se cobró. */
  async rejectDispute(id: string): Promise<PaySurchargeActionResult> {
    return paySurchargeAction({ action: 'reject_dispute', id }, 'No se pudo rechazar la impugnación');
  },

  /** ADMIN. Cobro manual (además del job). 409 si no venció el preaviso; 503 si PASARELAS_MODO o RECARGOS_MODO no son ACTIVO. */
  async charge(id: string): Promise<PaySurchargeActionResult> {
    return paySurchargeAction({ action: 'charge', id }, 'No se pudo cobrar el recargo');
  },
};

/** POST común de las acciones de un recargo. */
async function paySurchargeAction(body: { action: string; id: string; reason?: string }, fallback: string): Promise<PaySurchargeActionResult> {
  const raw = await http<Envelope<PaySurcharge>>(SURCHARGES, { method: 'POST', body });
  return {
    surcharge: unwrap(raw, fallback),
    result: raw?.result,
    refundRequested: raw?.refund_requested === true ? true : raw?.refund_requested === false ? false : undefined,
    replayed: raw?.replayed === true,
  };
}
