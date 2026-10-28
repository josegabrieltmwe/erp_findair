import { http } from '../../anagrafiche/services/http';
import { ApiError } from '../../anagrafiche/services/api.types';

/**
 * Cuentas SMTP por partner. Dos puertas con el mismo contrato:
 *  - `partnerSmtpSelf`: el administrador del partner gestiona las SUYAS (/api_partner_smtp). El partner
 *    sale de la sesion; el cliente nunca envia su id.
 *  - `partnerSmtpAdmin`: personal de TMWE sobre cualquier partner (/api_admin_partner_smtp), indicando
 *    `anagrafica_id` al crear, probar o diagnosticar.
 * La contraseña es de solo escritura: llega `has_password`, nunca el valor.
 */

export const SMTP_PURPOSES = [
  'default',
  'billing',
  'tracking',
  'crm',
  'alert',
  'reset_password',
  'transactional',
  'other',
  'pec',
] as const;
export type SmtpPurpose = (typeof SMTP_PURPOSES)[number];
export type SmtpEnvironment = 'production' | 'sandbox';
export type SmtpSecurity = 'TLS' | 'SSL' | 'NONE';
export const SMTP_PORTS = [25, 465, 587, 2525] as const;

export interface SmtpAccount {
  id: number;
  purpose: SmtpPurpose;
  environment: SmtpEnvironment;
  smtp_server: string;
  smtp_port: number;
  smtp_security: SmtpSecurity;
  smtp_user: string;
  has_password: boolean;
  from_email: string;
  from_name: string;
  description: string;
  stato: string;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  /** Solo en la vista de administracion. */
  partner_id?: number;
  partner_name?: string | null;
}

export interface SmtpAccountPayload {
  id?: number;
  purpose: SmtpPurpose;
  environment: SmtpEnvironment;
  smtp_server: string;
  smtp_port: number;
  smtp_security: SmtpSecurity;
  smtp_user: string;
  /** Vacio en una edicion = se mantiene la guardada. */
  smtp_password?: string;
  from_email: string;
  from_name?: string;
  description?: string;
}

export type SmtpSource = 'own' | 'tmwe_default' | 'none';

export interface SmtpEffective {
  purpose: SmtpPurpose;
  source: SmtpSource;
  account_id: number | null;
  from_email: string | null;
  from_name: string | null;
}

export interface SmtpPurposeInfo {
  purpose: SmtpPurpose;
  description: string;
}

export interface SmtpTestResult {
  [k: string]: unknown;
}

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

/** Errores por campo que devuelve el backend (`error.details.fields`), si los hay. */
export function smtpFieldErrors(err: unknown): Record<string, string> {
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

function unwrap<T>(raw: Envelope<T> | undefined, fallback: string): T {
  if (!raw || raw.success === false) throw new Error(raw?.error || fallback);
  return raw.data as T;
}

function createService(endpoint: string, withPartner: boolean) {
  const scoped = (partnerId?: number): Record<string, number> =>
    withPartner && partnerId ? { anagrafica_id: partnerId } : {};

  return {
    async list(filters: { partnerId?: number; purpose?: string; environment?: string } = {}): Promise<SmtpAccount[]> {
      const query: Record<string, string | number> = { ...scoped(filters.partnerId) };
      if (filters.purpose) query.purpose = filters.purpose;
      if (filters.environment) query.environment = filters.environment;
      const raw = await http<Envelope<SmtpAccount[]>>(endpoint, { query });
      return unwrap(raw, 'No se pudieron cargar las cuentas SMTP') ?? [];
    },

    async purposes(): Promise<SmtpPurposeInfo[]> {
      const raw = await http<Envelope<SmtpPurposeInfo[]>>(endpoint, { query: { view: 'purposes' } });
      return unwrap(raw, 'No se pudieron cargar los propósitos') ?? [];
    },

    async effective(partnerId?: number): Promise<SmtpEffective[]> {
      const raw = await http<Envelope<SmtpEffective[]>>(endpoint, {
        query: { view: 'effective', ...scoped(partnerId) },
      });
      return unwrap(raw, 'No se pudo calcular la cuenta efectiva') ?? [];
    },

    async resolve(purpose: SmtpPurpose, partnerId?: number, from?: string): Promise<Record<string, unknown>> {
      const query: Record<string, string | number> = { view: 'resolve', purpose, ...scoped(partnerId) };
      if (from) query.from = from;
      const raw = await http<Envelope<Record<string, unknown>>>(endpoint, { query });
      return unwrap(raw, 'No se pudo resolver la cuenta') ?? {};
    },

    async create(payload: SmtpAccountPayload, partnerId?: number): Promise<SmtpAccount> {
      const raw = await http<Envelope<SmtpAccount>>(endpoint, {
        method: 'POST',
        body: { ...payload, ...scoped(partnerId) },
      });
      return unwrap(raw, 'No se pudo crear la cuenta');
    },

    async update(payload: SmtpAccountPayload & { id: number }): Promise<SmtpAccount> {
      const raw = await http<Envelope<SmtpAccount>>(endpoint, { method: 'PUT', body: payload });
      return unwrap(raw, 'No se pudo guardar la cuenta');
    },

    async remove(id: number): Promise<void> {
      const raw = await http<Envelope<unknown>>(endpoint, { method: 'DELETE', body: { id } });
      unwrap(raw, 'No se pudo eliminar la cuenta');
    },

    /** Prueba una cuenta guardada (`id`) o credenciales sin guardar. */
    async test(
      input: { id: number; test_recipient?: string } | (SmtpAccountPayload & { test_recipient?: string }),
      partnerId?: number,
    ): Promise<SmtpTestResult> {
      const raw = await http<Envelope<SmtpTestResult>>(endpoint, {
        method: 'POST',
        body: { action: 'test', ...input, ...scoped(partnerId) },
      });
      return unwrap(raw, 'La prueba ha fallado') ?? {};
    },
  };
}

export const partnerSmtpSelf = createService('/api_partner_smtp', false);
export const partnerSmtpAdmin = createService('/api_admin_partner_smtp', true);
export type PartnerSmtpService = typeof partnerSmtpSelf;
