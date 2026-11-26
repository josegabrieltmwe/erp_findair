import { http } from '../../anagrafiche/services/http';

/**
 * Auto-registro de clientes de FindAir: revisión por el titular (P147, docs/contrato-con-api.md).
 *
 *  - `api_self_registration_admin`: cola (GET con filtros), ficha (GET ?id=N), aprobar y rechazar (POST). Personal
 *    del ERP (TMWE o `erp:view`); cada partner ve solo sus solicitudes (una ajena responde 404) y TMWE puede acotar
 *    con `id_anagr_titolare`. Solo se decide sobre `verified`.
 *  - `api_self_registration_config`: configuración del titular (GET/PUT). TMWE o administrador del partner
 *    (`partner:manage`); si no, 403 `PARTNER_ADMIN_REQUIRED`.
 *
 * Las fechas llegan en UTC sin zona (`YYYY-MM-DD HH:MM:SS`): ver `parseUtc`.
 * Contrato: tmwe_api/docs/api/open_api/tmwe-erp-api.yaml, tag SelfRegistration.
 */

export const SELF_REGISTRATION_STATUSES = [
  'pending_verification',
  'verified',
  'approved',
  'rejected',
  'expired',
  'blocked_config',
] as const;
export type SelfRegistrationStatus = (typeof SELF_REGISTRATION_STATUSES)[number];

export type DuplicateReason = 'vat' | 'company_name' | 'email_domain';

/** Fila de la cola (`present()` del api). Nunca lleva token ni hash. */
export interface SelfRegistrationRow {
  id: number;
  id_anagr_titolare: number;
  channel: string;
  status: SelfRegistrationStatus;
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
  country_iso: string;
  vat_number: string;
  phone: string;
  language: string;
  id_anagrafica: number | null;
  id_contatto: number | null;
  vies_result: string | null;
  privacy_version: string;
  terms_version: string;
  consent_at: string | null;
  created_at: string | null;
  verified_at: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
}

export interface SelfRegistrationDuplicate {
  id_anagrafica: number;
  rag_soc: string;
  pi_cf: string;
  reason: DuplicateReason;
}

export interface SelfRegistrationSede {
  id?: number;
  indirizzo?: string;
  citta?: string;
  cap?: string;
  prov?: string;
  id_paese_iso?: string;
  tel?: string;
  /** Código destinatario SDI (solo Italia). */
  cod_destin?: string;
  PEC?: string;
}

/** Cuenta creada al activar (anagrafica prospecto + sede de facturación + contacto). */
export interface SelfRegistrationAccount {
  anagrafica: {
    id: number;
    rag_soc: string;
    pi_cf: string;
    tipo: string;
    bloccato: string;
    vies_check: string;
  } | null;
  sede: SelfRegistrationSede | null;
  contact: {
    id: number;
    loginn: string;
    stato: string;
    secure_credential: boolean;
  } | null;
}

export interface SelfRegistrationDetail extends SelfRegistrationRow {
  ip: string;
  user_agent: string;
  review_notes: string | null;
  customer_message: string | null;
  duplicates: SelfRegistrationDuplicate[];
  account: SelfRegistrationAccount | null;
  /** Datos de facturación que faltarían si se aprobara sin correcciones (códigos de BILLING_MISSING_CODES). */
  billing_missing: BillingMissingCode[];
}

/** Datos sin los cuales el api no aprueba (422 BILLING_DATA_INCOMPLETE, `details.missing`). */
export const BILLING_MISSING_CODES = ['rag_soc', 'pi_cf', 'indirizzo', 'citta', 'sdi_or_pec', 'id_pagam_met', 'id_pagam_scad'] as const;
export type BillingMissingCode = (typeof BILLING_MISSING_CODES)[number];

export interface SelfRegistrationFilters {
  status?: SelfRegistrationStatus | '' | null;
  /** YYYY-MM-DD */
  date_from?: string | null;
  /** YYYY-MM-DD */
  date_to?: string | null;
  q?: string | null;
  page?: number;
  per_page?: number;
  /** Solo TMWE: acotar a un titular. */
  id_anagr_titolare?: number | null;
}

export interface SelfRegistrationPage {
  items: SelfRegistrationRow[];
  total: number;
  page: number;
  per_page: number;
}

/** Correcciones al aprobar: solo se envían los campos que cambian. */
export interface ApproveCorrections {
  rag_soc?: string;
  pi_cf?: string;
  sede?: {
    indirizzo?: string;
    citta?: string;
    cap?: string;
    prov?: string;
    id_paese_iso?: string;
    cod_destin?: string;
    PEC?: string;
  };
}

export interface SelfRegistrationDecision {
  id: number;
  status: SelfRegistrationStatus;
}

export interface SelfRegistrationConfig {
  id_anagr_titolare: number;
  enabled: boolean;
  activation_base_url: string;
  login_client_id: string;
  privacy_url: string;
  privacy_version: string;
  terms_version: string;
  notify_emails: string[];
  id_pagam_met_card: number | null;
  /** Vencimiento (pagamenti_scad_new.id) que se pone al cliente aprobado; sin él no es facturable. */
  id_pagam_scad_card: number | null;
  turnstile_required: boolean;
  daily_limit: number;
}

export type SelfRegistrationConfigInput = Omit<SelfRegistrationConfig, 'id_anagr_titolare'>;

const ADMIN_ENDPOINT = '/api_self_registration_admin';
const CONFIG_ENDPOINT = '/api_self_registration_config';

function dataOf<T>(raw: unknown): T {
  const r = raw as { data?: T } | null;
  return (r && typeof r === 'object' && 'data' in r ? r.data : raw) as T;
}

/** Quita vacíos: el api trata `''` como filtro ausente, pero así la URL queda limpia. */
function listQuery(f: SelfRegistrationFilters): Record<string, string | number> {
  const q: Record<string, string | number> = {};
  if (f.status) q.status = f.status;
  if (f.date_from) q.date_from = f.date_from;
  if (f.date_to) q.date_to = f.date_to;
  const text = (f.q ?? '').trim();
  if (text) q.q = text;
  q.page = Math.max(1, f.page ?? 1);
  q.per_page = Math.min(100, Math.max(1, f.per_page ?? 25));
  if (f.id_anagr_titolare && f.id_anagr_titolare > 0) q.id_anagr_titolare = f.id_anagr_titolare;
  return q;
}

/**
 * Correcciones que de verdad cambian algo respecto a la cuenta creada. Un campo igual al actual (o vacío en los
 * fiscales, que el api ignora) no se envía.
 */
export function diffCorrections(
  current: { rag_soc?: string; pi_cf?: string; sede?: SelfRegistrationSede | null },
  edited: { rag_soc: string; pi_cf: string; sede: Required<NonNullable<ApproveCorrections['sede']>> },
): ApproveCorrections {
  const out: ApproveCorrections = {};
  for (const k of ['rag_soc', 'pi_cf'] as const) {
    const v = edited[k].trim();
    if (v !== '' && v !== (current[k] ?? '').trim()) out[k] = v;
  }
  const sede: NonNullable<ApproveCorrections['sede']> = {};
  for (const k of ['indirizzo', 'citta', 'cap', 'prov', 'id_paese_iso', 'cod_destin', 'PEC'] as const) {
    const v = (edited.sede[k] ?? '').trim();
    if (v !== String(current.sede?.[k] ?? '').trim()) sede[k] = v;
  }
  if (Object.keys(sede).length > 0) out.sede = sede;
  return out;
}

export const selfRegistrationService = {
  async list(filters: SelfRegistrationFilters): Promise<SelfRegistrationPage> {
    const raw = await http<unknown>(ADMIN_ENDPOINT, { query: listQuery(filters) });
    const d = dataOf<Partial<SelfRegistrationPage> | null>(raw) ?? {};
    return {
      items: Array.isArray(d.items) ? d.items : [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 1),
      per_page: Number(d.per_page ?? 25),
    };
  },

  async get(id: number): Promise<SelfRegistrationDetail> {
    const raw = await http<unknown>(ADMIN_ENDPOINT, { query: { id } });
    const d = dataOf<SelfRegistrationDetail>(raw);
    return {
      ...d,
      duplicates: Array.isArray(d?.duplicates) ? d.duplicates : [],
      account: d?.account ?? null,
      billing_missing: Array.isArray(d?.billing_missing) ? d.billing_missing : [],
    };
  },

  async approve(id: number, corrections: ApproveCorrections, notes?: string): Promise<SelfRegistrationDecision> {
    const body: Record<string, unknown> = { action: 'approve', id };
    if (Object.keys(corrections).length > 0) body.corrections = corrections;
    if (notes && notes.trim()) body.notes = notes.trim();
    const raw = await http<unknown>(ADMIN_ENDPOINT, { method: 'POST', body });
    return dataOf<SelfRegistrationDecision>(raw);
  },

  async reject(id: number, notes: string, customerMessage?: string): Promise<SelfRegistrationDecision> {
    const body: Record<string, unknown> = { action: 'reject', id, notes: notes.trim() };
    if (customerMessage && customerMessage.trim()) body.customer_message = customerMessage.trim();
    const raw = await http<unknown>(ADMIN_ENDPOINT, { method: 'POST', body });
    return dataOf<SelfRegistrationDecision>(raw);
  },

  async getConfig(titolareId?: number | null): Promise<SelfRegistrationConfig> {
    const query = titolareId && titolareId > 0 ? { id_anagr_titolare: titolareId } : {};
    const raw = await http<unknown>(CONFIG_ENDPOINT, { query });
    return normalizeConfig(dataOf<Partial<SelfRegistrationConfig>>(raw));
  },

  async saveConfig(cfg: SelfRegistrationConfigInput, titolareId?: number | null): Promise<SelfRegistrationConfig> {
    const query = titolareId && titolareId > 0 ? { id_anagr_titolare: titolareId } : {};
    const raw = await http<unknown>(CONFIG_ENDPOINT, { method: 'PUT', query, body: cfg });
    return normalizeConfig(dataOf<Partial<SelfRegistrationConfig>>(raw));
  },
};

export function normalizeConfig(c: Partial<SelfRegistrationConfig> | null | undefined): SelfRegistrationConfig {
  const x = c ?? {};
  const card = Number(x.id_pagam_met_card ?? 0);
  const scad = Number(x.id_pagam_scad_card ?? 0);
  return {
    id_anagr_titolare: Number(x.id_anagr_titolare ?? 0),
    enabled: x.enabled === true || (x.enabled as unknown) === 1 || (x.enabled as unknown) === '1',
    activation_base_url: String(x.activation_base_url ?? ''),
    login_client_id: String(x.login_client_id ?? ''),
    privacy_url: String(x.privacy_url ?? ''),
    privacy_version: String(x.privacy_version ?? ''),
    terms_version: String(x.terms_version ?? ''),
    notify_emails: Array.isArray(x.notify_emails) ? x.notify_emails.map(String) : [],
    id_pagam_met_card: card > 0 ? card : null,
    id_pagam_scad_card: scad > 0 ? scad : null,
    turnstile_required: x.turnstile_required === true || (x.turnstile_required as unknown) === 1 || (x.turnstile_required as unknown) === '1',
    daily_limit: Number(x.daily_limit ?? 200),
  };
}

/** Fecha del api (UTC sin zona, `YYYY-MM-DD HH:MM:SS`) → Date; null si no parsea. */
export function parseUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s.replace(' ', 'T')}Z` : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha y hora en el formato del idioma de la interfaz (hora local del navegador). */
export function formatDateTime(value: string | null | undefined, locale: string): string {
  const d = parseUtc(value);
  if (!d) return value ? String(value) : '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

/** Horas transcurridas desde una fecha UTC del api (para "esperando decisión desde hace…"). */
export function hoursSince(value: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseUtc(value);
  return d ? Math.floor((now.getTime() - d.getTime()) / 3_600_000) : null;
}
