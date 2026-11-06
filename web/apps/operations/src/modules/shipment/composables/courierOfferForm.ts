import type { CourierOfferView, CourierQuoteBody } from "@shipment/services/courier_offer.service";

/**
 * Formulario de respuesta del courier/partner (sin Vue): validación local, payload y errores del servidor. El servidor
 * valida de nuevo todo; esto solo evita enviar lo que se sabe inválido.
 */

export interface CourierQuoteForm {
  /** Texto tal como lo escribe (admite coma decimal). */
  costo: string;
  currency: string;
  note: string;
  schedule: string;
  confirmPrice: boolean;
  confirmTerms: boolean;
}

export const CURRENCIES: readonly string[] = ["EUR", "USD", "GBP", "CHF", "CNY", "JPY"];
export const MAX_AMOUNT = 999999.99;
export const MAX_NOTE = 4000;
export const MAX_SCHEDULE = 2000;

export function formFromView(view: Pick<CourierOfferView, "change_valuta">): CourierQuoteForm {
  const currency = String(view.change_valuta ?? "").toUpperCase();
  return { costo: "", currency: /^[A-Z]{3}$/.test(currency) ? currency : "EUR", note: "", schedule: "", confirmPrice: false, confirmTerms: false };
}

/** «1.234,50» no se interpreta: solo coma o punto como decimal, sin separador de miles. null si no es un importe. */
export function parseAmount(text: string): number | null {
  const t = String(text ?? "").trim().replace(",", ".");
  if (t === "" || !/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Claves i18n (bajo `shipment.courierOffer.`) por campo; vacío = válido. */
export function validateForm(form: CourierQuoteForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const amount = parseAmount(form.costo);
  if (amount === null || amount <= 0 || amount > MAX_AMOUNT) errors.costo = "validation_amount";
  if (!/^[A-Z]{3}$/.test(form.currency)) errors.currency = "validation_currency";
  if (form.note.length > MAX_NOTE) errors.note = "validation_too_long";
  if (form.schedule.length > MAX_SCHEDULE) errors.schedule = "validation_too_long";
  if (!form.confirmPrice || !form.confirmTerms) errors.confirm = "validation_confirm";
  return errors;
}

export function buildPayload(form: CourierQuoteForm): CourierQuoteBody {
  return {
    costo: parseAmount(form.costo) ?? 0,
    change_valuta: form.currency,
    txt_risposta: form.note.trim(),
    txt_schedule: form.schedule.trim(),
    confirm: { price: form.confirmPrice, terms: form.confirmTerms },
  };
}

/** Errores por campo del servidor (`error.details.fields`) → claves de los campos del formulario. */
export function mapServerFields(fields: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, code] of Object.entries(fields ?? {})) {
    if (field === "costo") out.costo = "validation_amount";
    else if (field === "change_valuta") out.currency = "validation_currency";
    else if (field === "txt_risposta") out.note = code === "too_long" ? "validation_too_long" : "validation_generic";
    else if (field === "txt_schedule") out.schedule = code === "too_long" ? "validation_too_long" : "validation_generic";
  }
  return out;
}
