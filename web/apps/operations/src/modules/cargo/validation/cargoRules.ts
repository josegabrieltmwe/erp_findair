import type { Cargo } from "@cargo/services/cargo.types";

/**
 * Centralised front-end validation for the cargo edit BUFFER.
 *
 * Design note (pragmatism): validation is run **centrally at commit time**
 * (`validateDraft` is called from the store's `commitDraft`), not field-by-field
 * on every keystroke/blur. Boxes keep their dumb `v-model` + `useFieldBinding`
 * bindings; the buffer accumulates raw values and we validate the whole patch
 * once, when the user presses "Salva". This keeps the ~14 *Box.vue components
 * untouched at the cost of not surfacing inline per-field hints while typing.
 *
 * Only the sensitive subset of fields is validated. Fields not listed here are
 * passed through unvalidated (free text, flags, etc.). Field names are the real
 * columns from the `Cargo` type (src/services/cargo.types.ts) — no invented
 * columns.
 */

export type FieldError = string;

/** A validator returns null when valid, or an error message string. */
type Validator = (value: unknown) => FieldError | null;

/** Empty / unset values are treated as valid (the field is simply absent). */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/** Numeric, >= 0. Accepts numbers or numeric strings (legacy payloads). */
function nonNegativeNumber(label: string): Validator {
  return (value) => {
    if (isBlank(value)) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return `${label}: valore numerico non valido`;
    if (n < 0) return `${label}: non puo essere negativo`;
    return null;
  };
}

/** Non-negative integer (used for foreign-key ids). */
function nonNegativeInteger(label: string): Validator {
  return (value) => {
    if (isBlank(value)) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n))
      return `${label}: deve essere un intero`;
    if (n < 0) return `${label}: non puo essere negativo`;
    return null;
  };
}

/** ISO 4217 currency code — exactly 3 ASCII letters. */
function isoCurrency(label: string): Validator {
  return (value) => {
    if (isBlank(value)) return null;
    const s = String(value).trim();
    if (!/^[A-Za-z]{3}$/.test(s))
      return `${label}: codice valuta ISO non valido (3 lettere)`;
    return null;
  };
}

/**
 * Field → validator map. Keys are real `Cargo` columns.
 * Used by `validateDraft` to validate only the keys present in the patch.
 */
export const cargoRules: Partial<Record<keyof Cargo, Validator>> = {
  // Money / numeric amounts (>= 0)
  dogana_imp: nonNegativeNumber("Valore in dogana"),
  assicuraz_imp: nonNegativeNumber("Valore assicurato"),
  peso: nonNegativeNumber("Peso"),
  pesor: nonNegativeNumber("Peso reale"),
  peso_reale: nonNegativeNumber("Peso reale"),
  peso_fornit_reale: nonNegativeNumber("Peso fornitore"),
  carico_export: nonNegativeNumber("Carico export"),
  carico_import: nonNegativeNumber("Carico import"),
  carico_volo: nonNegativeNumber("Carico volo"),
  costo_volo_previsto: nonNegativeNumber("Costo volo previsto"),
  costo_volo_reale: nonNegativeNumber("Costo volo reale"),

  // ISO currency codes (3 letters)
  id_valuta_dogana: isoCurrency("Valuta dogana"),
  id_valuta_assic: isoCurrency("Valuta assicurazione"),
  id_valuta_cliente: isoCurrency("Valuta cliente"),

  // Foreign-key ids (non-negative integers)
  id_cliente: nonNegativeInteger("Cliente"),
  id_sede: nonNegativeInteger("Sede"),
  id_partner: nonNegativeInteger("Partner"),
  id_ag_export: nonNegativeInteger("Agenzia export"),
  id_ag_import: nonNegativeInteger("Agenzia import"),
};

/**
 * Validate a draft patch. Only the keys present in the patch are checked.
 * Returns a map of `field → message` for the invalid fields (empty = valid).
 *
 * `locked` lets the caller skip fields that are read-only by cargo state
 * (e.g. carico_volo / costo_volo_previsto when the cargo is already invoiced):
 * a locked field cannot have been edited through the UI, so we do not block
 * the save on it even if the legacy payload carries an odd value.
 */
export function validateDraft(
  patch: Partial<Cargo>,
  locked?: (field: keyof Cargo) => boolean,
): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};
  for (const key of Object.keys(patch) as (keyof Cargo)[]) {
    if (locked?.(key)) continue;
    const rule = cargoRules[key];
    if (!rule) continue;
    const msg = rule(patch[key]);
    if (msg) errors[key as string] = msg;
  }
  return errors;
}
