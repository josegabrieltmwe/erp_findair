import { apiErrorCode, apiErrorDetails, apiFieldErrors, localizedErrorText } from '../../utils/apiError';

type I18n = {
  t: (key: string, named?: Record<string, unknown>) => string;
  te: (key: string) => boolean;
};

/**
 * Texto de un error de los endpoints de auto-registro. Los códigos propios (`NOT_FOUND`, `NOT_REVIEWABLE`,
 * `ALREADY_REVIEWED`, `VALIDATION_ERROR`, `ERP_STAFF_REQUIRED`, `PARTNER_ADMIN_REQUIRED`, `APPROVAL_FAILED`,
 * `REJECTION_FAILED`) se traducen bajo `self_registration.errors.<CODE>`; el resto pasa por `errors.api.<CODE>` o
 * el mensaje del servidor.
 */
export function selfRegistrationErrorText(e: unknown, i18n: I18n): string {
  const code = apiErrorCode(e);
  if (code && i18n.te(`self_registration.errors.${code}`)) return i18n.t(`self_registration.errors.${code}`);
  return localizedErrorText(e, i18n, i18n.t('self_registration.errors.generic'));
}

/**
 * Errores por campo de un 422 (`details.fields`), con el valor traducido (`required`, `invalid`,
 * `https_url_required`…) bajo `self_registration.field_error.<valor>`; un valor desconocido se muestra tal cual.
 */
export function selfRegistrationFieldErrors(e: unknown, i18n: I18n): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(apiFieldErrors(e))) {
    const key = `self_registration.field_error.${value}`;
    out[field] = i18n.te(key) ? i18n.t(key) : value;
  }
  return out;
}

/** Datos de facturación que faltan según un 422 BILLING_DATA_INCOMPLETE (`details.missing`); vacío para otro error. */
export function selfRegistrationBillingMissing(e: unknown): string[] {
  if (apiErrorCode(e) !== 'BILLING_DATA_INCOMPLETE') return [];
  const missing = apiErrorDetails(e).missing;
  return Array.isArray(missing) ? missing.filter((x): x is string => typeof x === 'string') : [];
}
