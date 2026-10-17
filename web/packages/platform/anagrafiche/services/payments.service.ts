import { http } from './http';

/**
 * Payment methods / schedules of a partner (the *titolare*), used to populate
 * the commercial selects of a client form (id_pagam_met / id_pagam_scad).
 *
 * Multi-tenant: the backend resolves the partner from the session. TMWE
 * operators (anagrafica id=1) editing a partner's client pass the client's
 * `id_anagr_titolare` as `id_anagrafica` so the selects show THAT partner's
 * config — see Abstract_Pagamenti_Controller::resolve_target_partner_id().
 * A non-TMWE caller cannot read another partner's config (the param is ignored).
 */

export interface PaymentMethodOption {
  id: number;
  descr?: string;
  descrEN?: string;
  tipo?: string;
  [k: string]: unknown;
}

export interface PaymentScheduleOption {
  id: number;
  /** Human-readable label computed server-side (days/month rules). */
  label?: string;
  descr?: string;
  [k: string]: unknown;
}

const METHODS_ENDPOINT = '/api_payment_methods';
const SCHEDULES_ENDPOINT = '/api_payment_schedules';

function unwrapList<T>(raw: unknown): T[] {
  const r = raw as { data?: T[]; items?: T[] } | null;
  if (Array.isArray(r?.data)) return r!.data as T[];
  if (Array.isArray(r?.items)) return r!.items as T[];
  return [];
}

/**
 * Build the query for a titolare-scoped read. `titolareId` is sent only when
 * provided (TMWE operator case); for a partner it is omitted and the backend
 * falls back to the session partner.
 */
function scopedQuery(titolareId?: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const q: Record<string, unknown> = { ...extra };
  if (titolareId && titolareId > 0) q.id_anagrafica = titolareId;
  return q;
}

export const paymentsService = {
  async paymentMethods(tipo?: string, titolareId?: number): Promise<PaymentMethodOption[]> {
    const raw = await http<unknown>(METHODS_ENDPOINT, {
      query: scopedQuery(titolareId, tipo ? { tipo } : {}),
    });
    return unwrapList<PaymentMethodOption>(raw);
  },

  async paymentSchedules(titolareId?: number): Promise<PaymentScheduleOption[]> {
    const raw = await http<unknown>(SCHEDULES_ENDPOINT, {
      query: scopedQuery(titolareId),
    });
    return unwrapList<PaymentScheduleOption>(raw);
  },
};

/**
 * Client sectors (studi_settore) — global master table, not partner-scoped.
 */
export interface SectorOption {
  id: number;
  descr?: string;
  [k: string]: unknown;
}

const SECTORS_ENDPOINT = '/api_master_studi_settore';

export const sectorsService = {
  async list(): Promise<SectorOption[]> {
    const raw = await http<unknown>(SECTORS_ENDPOINT, {});
    return unwrapList<SectorOption>(raw);
  },
};
