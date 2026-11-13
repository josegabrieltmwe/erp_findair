import { i18n } from "../../../plugins/i18n";

/**
 * Codigos de negocio del API (422/409) con frase propia en `invoicing.errors.<CODIGO>`.
 * Antes el operador veia el detalle crudo del backend (en espanol y tecnico),
 * p. ej. «IVA_SIN_CAUSAL_SDI: ...». Collaudo 13/11 (S7).
 */
const KNOWN = new Set([
  "IVA_SIN_CAUSAL_SDI",
  "INVOICE_DATE_IN_THE_FUTURE",
  "INVOICE_DATE_BEFORE_SERVICE",
  "FISCAL_YEAR_CLOSED",
  "CURRENCY_RATE_MISSING",
]);

/**
 * Frase traducida para un error del API; si el codigo no esta en el mapa (o no
 * hay codigo) se devuelve el mensaje original, sin tocarlo.
 */
export function apiErrorText(
  err: { errorCode?: string; message?: string } | null | undefined,
): string {
  const code = err?.errorCode;
  const raw = err?.message ?? "";
  if (code && KNOWN.has(code)) {
    const key = `invoicing.errors.${code}`;
    if (i18n.global.te(key)) return String(i18n.global.t(key));
  }
  return raw;
}
