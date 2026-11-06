import type { CarrierCharge, CarrierOfferView } from "@cargo/services/carrier_offer.service";
import { computeOfferTotal } from "./carrierOfferTotal";

/**
 * Formulario de la respuesta de la aerolínea (legado vttoff.php: costes por línea, peso tasable, notas, horario y referencia).
 * Lógica pura, sin Vue. La validación de aquí es una ayuda para avisar antes de enviar; el servidor vuelve a validarlo todo.
 */

export const AMOUNT_MAX = 9_999_999;
export const WEIGHT_MAX = 999_999;
export const NOTE_MAX = 4000;
export const SCHEDULE_MAX = 2000;
export const REFERENCE_MAX = 100;

export interface LineForm {
  id: number;
  /** Importes de la aerolínea como texto del campo; '' = «los de TMWE». */
  unit: string;
  min: string;
  max: string;
}

export interface QuoteForm {
  lines: LineForm[];
  weight: string;
  note: string;
  schedule: string;
  reference: string;
  confirmPrice: boolean;
  confirmTerms: boolean;
}

export interface QuotePayload {
  lines: Array<{ id: number; costo_unitV: number; costo_minV: number; costo_maxV: number }>;
  chargeable_weight: number;
  note: string;
  schedule: string;
  reference: string;
  confirm: { price: boolean; terms: boolean };
}

/** Importe tecleado: '' = 0, admite coma decimal; null si no vale (texto, negativo o por encima del máximo). */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return 0;
  const text = String(raw).trim().replace(",", ".");
  if (text === "") return 0;
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return n > AMOUNT_MAX ? null : n;
}

function shown(value: string | number | null | undefined): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

/** Valores de partida: lo que la aerolínea ya respondió (sus columnas «V») y, si respondió, su texto. */
export function formFromView(view: CarrierOfferView): QuoteForm {
  return {
    lines: view.charges.map((c) => ({ id: c.id, unit: shown(c.costo_unitV), min: shown(c.costo_minV), max: shown(c.costo_maxV) })),
    weight: view.chargeable_weight > 0 ? String(view.chargeable_weight) : "",
    note: view.reply.note,
    schedule: view.reply.schedule,
    reference: view.reply.reference,
    confirmPrice: false,
    confirmTerms: false,
  };
}

/** Las líneas de coste con los importes de la aerolínea tecleados encima: lo que el servidor va a sumar. */
export function chargesWithForm(charges: CarrierCharge[], form: QuoteForm): CarrierCharge[] {
  return charges.map((c) => {
    const l = form.lines.find((x) => x.id === c.id);
    if (!l) return c;
    return { ...c, costo_unitV: parseAmount(l.unit) ?? 0, costo_minV: parseAmount(l.min) ?? 0, costo_maxV: parseAmount(l.max) ?? 0 };
  });
}

/** Total que verá la aerolínea mientras teclea (el definitivo lo calcula el servidor). */
export function liveTotal(view: Pick<CarrierOfferView, "charges" | "freight">, form: QuoteForm): number {
  const weight = parseAmount(form.weight) ?? 0;
  return computeOfferTotal(chargesWithForm(view.charges, form), weight, view.freight.parcels_count);
}

/** Errores por campo (clave → clave i18n bajo `cargo.carrierOffer.`); vacío si se puede enviar. */
export function validateForm(form: QuoteForm): Record<string, string> {
  const errors: Record<string, string> = {};
  form.lines.forEach((l, i) => {
    if (parseAmount(l.unit) === null) errors[`lines.${i}.unit`] = "validation_amount";
    if (parseAmount(l.min) === null) errors[`lines.${i}.min`] = "validation_amount";
    if (parseAmount(l.max) === null) errors[`lines.${i}.max`] = "validation_amount";
  });
  const weight = parseAmount(form.weight);
  if (weight === null || weight <= 0 || weight > WEIGHT_MAX) errors.weight = "validation_weight";
  if (form.note.length > NOTE_MAX) errors.note = "validation_too_long";
  if (form.schedule.length > SCHEDULE_MAX) errors.schedule = "validation_too_long";
  if (form.reference.length > REFERENCE_MAX) errors.reference = "validation_too_long";
  if (!form.confirmPrice || !form.confirmTerms) errors.confirm = "validation_confirm";
  return errors;
}

/** Cuerpo del POST. No lleva total: lo calcula el servidor. */
export function buildPayload(form: QuoteForm): QuotePayload {
  return {
    lines: form.lines.map((l) => ({
      id: l.id,
      costo_unitV: parseAmount(l.unit) ?? 0,
      costo_minV: parseAmount(l.min) ?? 0,
      costo_maxV: parseAmount(l.max) ?? 0,
    })),
    chargeable_weight: parseAmount(form.weight) ?? 0,
    note: form.note,
    schedule: form.schedule,
    reference: form.reference,
    confirm: { price: form.confirmPrice, terms: form.confirmTerms },
  };
}

const SERVER_FIELD = { costo_unitV: "unit", costo_minV: "min", costo_maxV: "max" } as const;

/** Errores por campo del servidor (`lines.0.costo_unitV`, `chargeable_weight`, `note`…) → claves del formulario y su texto. */
export function mapServerFields(fields: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, code] of Object.entries(fields ?? {})) {
    const line = /^lines\.(\d+)\.(costo_unitV|costo_minV|costo_maxV|id)$/.exec(key);
    if (line) {
      const target = line[2] === "id" ? `lines.${line[1]}.unit` : `lines.${line[1]}.${SERVER_FIELD[line[2] as keyof typeof SERVER_FIELD]}`;
      out[target] = code === "unknown_line" ? "validation_unknown_line" : "validation_amount";
    } else if (key === "chargeable_weight") {
      out.weight = "validation_weight";
    } else if (key === "total") {
      out.total = "validation_total";
    } else if (code === "too_long") {
      out[key] = "validation_too_long";
    } else {
      out[key] = "validation_generic";
    }
  }
  return out;
}
