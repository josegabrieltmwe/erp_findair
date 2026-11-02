import { apiErrorCode, apiErrorDetails, apiErrorStatus, localizedErrorText } from '../../utils/apiError';

/**
 * Lógica pura del alta de un partner con administrador de cuenta y del envío del enlace de acceso (P38 / H4).
 * Sin Vue ni red para poder probarla. El API es el que decide; esto solo evita ida y vuelta evidente.
 */

/** Datos del administrador de la cuenta que se pide al dar de alta un partner. */
export interface AdminContactInput {
  nome: string;
  mail: string;
}

/** Errores por campo: clave del campo del API -> clave i18n. */
export type AdminContactErrors = Partial<Record<'admin_contact.nome' | 'admin_contact.mail', string>>;

/** Formato de correo razonable (el API valida de nuevo con Field_Format_Validator::email). */
export function isValidEmail(value: unknown): boolean {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Un partner del sistema es erp_partner='S' y tipo='P'. */
export function isPartnerForm(form: Record<string, unknown>): boolean {
  return form.erp_partner === 'S' && form.tipo === 'P';
}

/** Valida `admin_contact`; devuelve claves i18n por campo ({} = válido). */
export function validateAdminContact(admin: AdminContactInput): AdminContactErrors {
  const errors: AdminContactErrors = {};
  if (!admin.nome || admin.nome.trim() === '') {
    errors['admin_contact.nome'] = 'anagrafiche.admin_contact.errors.nome_required';
  }
  if (!admin.mail || admin.mail.trim() === '') {
    errors['admin_contact.mail'] = 'anagrafiche.admin_contact.errors.mail_required';
  } else if (!isValidEmail(admin.mail)) {
    errors['admin_contact.mail'] = 'anagrafiche.admin_contact.errors.mail_invalid';
  }
  return errors;
}

/**
 * Cuerpo del alta. Solo los campos con valor. `admin_contact` (y `erp_partner`) van únicamente si es un alta de
 * partner hecha por TMWE; en cualquier otro caso se descartan (el alta de clientes no cambia).
 */
export function buildCreatePayload(
  form: Record<string, unknown>,
  admin: AdminContactInput,
  isTmwe: boolean,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(form)) {
    if (k === 'erp_partner') continue;
    if (v !== null && v !== '') payload[k] = v;
  }
  if (isTmwe && isPartnerForm(form)) {
    payload.erp_partner = 'S';
    payload.admin_contact = { nome: admin.nome.trim(), mail: admin.mail.trim() };
  }
  return payload;
}

/** `{ i18n } ` mínimo de useI18n() que necesitan los mensajes. */
export interface AccessLinkI18n {
  t: (key: string, named?: Record<string, unknown>) => string;
  te: (key: string) => boolean;
}

/**
 * Mensaje para el usuario de un fallo al enviar el enlace de acceso. 429 indica cuánto esperar; el resto sale de
 * `errors.api.<CODE>`; un 404 sin código usa su mensaje propio; si no hay traducción, el texto del servidor.
 */
export function accessLinkErrorText(e: unknown, i18n: AccessLinkI18n): string {
  const code = apiErrorCode(e);
  if (code === 'ACCESS_LINK_RATE_LIMITED' || apiErrorStatus(e) === 429) {
    const raw = Number(apiErrorDetails(e).retry_after);
    const seconds = Number.isFinite(raw) && raw > 0 ? Math.ceil(raw) : 60;
    return seconds <= 90
      ? i18n.t('anagrafiche.access_link.rate_limited_seconds', { n: seconds })
      : i18n.t('anagrafiche.access_link.rate_limited_minutes', { n: Math.ceil(seconds / 60) });
  }
  if (!code && apiErrorStatus(e) === 404) return i18n.t('anagrafiche.access_link.not_found');
  return localizedErrorText(e, i18n, i18n.t('common.error'));
}
