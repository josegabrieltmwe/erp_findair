import type { Shipment } from "@shipment/services/shipment.types";

/**
 * Pragmatic, centralised field validation for the draft-commit flow.
 *
 * DESIGN NOTE: ideal would be declarative per-field rules wired into each of
 * the ~14 *Box.vue components, but that is a large rewrite. Instead we validate
 * the accumulated draft patch at the single commit point (store.commitDraft →
 * validateDraft → these rules). This honours the requirement "validate before
 * insert/update" without touching every component.
 *
 * Rules are keyed by the exact Shipment field name. Only fields we can honestly
 * infer from their name are validated — we do NOT invent columns. A validator
 * returns null when the value is valid, or an error message string otherwise.
 * Empty / null / undefined values are treated as "not provided" and pass (the
 * backend keeps its own NOT NULL / business rules); we only reject values that
 * are present but malformed.
 */

export type FieldValidator = (value: unknown) => string | null;

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** Numeric and >= 0 (accepts numeric strings, the legacy on-wire format). */
function nonNegativeNumber(label: string): FieldValidator {
  return (value) => {
    if (isBlank(value)) return null;
    const n =
      typeof value === "number"
        ? value
        : Number(String(value).replace(",", "."));
    if (!Number.isFinite(n)) return `${label}: deve essere un numero`;
    if (n < 0) return `${label}: non può essere negativo`;
    return null;
  };
}

/** ISO 4217-ish: exactly 3 ASCII letters. */
function currencyIso(label: string): FieldValidator {
  return (value) => {
    if (isBlank(value)) return null;
    const s = String(value).trim();
    if (!/^[A-Za-z]{3}$/.test(s))
      return `${label}: codice valuta non valido (3 lettere, es. EUR)`;
    return null;
  };
}

/**
 * Field → validator map. Keys must be real Shipment columns (see
 * services/shipment.types.ts). Extend conservatively.
 */
export const SHIPMENT_FIELD_RULES: Partial<
  Record<keyof Shipment, FieldValidator>
> = {
  dogana_imp: nonNegativeNumber("Valore dogana"),
  assicuraz_imp: nonNegativeNumber("Assicurazione"),
  contras_imp: nonNegativeNumber("Contrassegno"),
  peso: nonNegativeNumber("Peso"),
  peso_tassato: nonNegativeNumber("Peso tassato"),
  peso_reale: nonNegativeNumber("Peso reale"),
  peso_fornit: nonNegativeNumber("Peso fornitore"),
  peso_fornit_reale: nonNegativeNumber("Peso reale fornitore"),
  id_valuta_dogana: currencyIso("Valuta dogana"),
  id_valuta_assic: currencyIso("Valuta assicurazione"),
  id_valuta_contras: currencyIso("Valuta contrassegno"),
  // NOTE: email lives on ShipmentAddress, not Shipment, and addresses persist
  // via saveAddress() (outside the draft), so there is no top-level email rule.
};

/**
 * Validate a (partial) shipment patch against the rule map. Only fields present
 * in the patch are checked. Returns the list of human-readable errors (empty
 * when everything passes).
 */
export function validateShipmentPatch(patch: Partial<Shipment>): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(patch) as (keyof Shipment)[]) {
    const rule = SHIPMENT_FIELD_RULES[key];
    if (!rule) continue;
    const msg = rule(patch[key]);
    if (msg) errors.push(msg);
  }
  return errors;
}
