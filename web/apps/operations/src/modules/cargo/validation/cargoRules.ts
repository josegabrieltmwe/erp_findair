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

/** Traductor con la forma de `i18n.global.t`: (clave, parametros) -> texto. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * A validator returns null when valid, or the i18n KEY of the reason (`cargo.validation.<motivo>`).
 * The field name comes from `cargo.validation.fields.<campo>`; `validateDraft` resolves the final text.
 */
type Validator = (value: unknown) => FieldError | null;

/** Empty / unset values are treated as valid (the field is simply absent). */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/** Numeric, >= 0. Accepts numbers or numeric strings (legacy payloads). */
function nonNegativeNumber(): Validator {
  return (value) => {
    if (isBlank(value)) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return "cargo.validation.not_number";
    if (n < 0) return "cargo.validation.negative";
    return null;
  };
}

/** Non-negative integer (used for foreign-key ids). */
function nonNegativeInteger(): Validator {
  return (value) => {
    if (isBlank(value)) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n))
      return "cargo.validation.not_integer";
    if (n < 0) return "cargo.validation.negative";
    return null;
  };
}

/** ISO 4217 currency code — exactly 3 ASCII letters. */
function isoCurrency(): Validator {
  return (value) => {
    if (isBlank(value)) return null;
    const s = String(value).trim();
    if (!/^[A-Za-z]{3}$/.test(s))
      return "cargo.validation.currency_invalid";
    return null;
  };
}

/**
 * Field → validator map. Keys are real `Cargo` columns.
 * Used by `validateDraft` to validate only the keys present in the patch.
 */
export const cargoRules: Partial<Record<keyof Cargo, Validator>> = {
  // Money / numeric amounts (>= 0)
  dogana_imp: nonNegativeNumber(),
  assicuraz_imp: nonNegativeNumber(),
  peso: nonNegativeNumber(),
  pesor: nonNegativeNumber(),
  peso_reale: nonNegativeNumber(),
  peso_fornit_reale: nonNegativeNumber(),
  carico_export: nonNegativeNumber(),
  carico_import: nonNegativeNumber(),
  carico_volo: nonNegativeNumber(),
  costo_volo_previsto: nonNegativeNumber(),
  costo_volo_reale: nonNegativeNumber(),

  // ISO currency codes (3 letters)
  id_valuta_dogana: isoCurrency(),
  id_valuta_assic: isoCurrency(),
  id_valuta_cliente: isoCurrency(),

  // Foreign-key ids (non-negative integers)
  id_cliente: nonNegativeInteger(),
  id_sede: nonNegativeInteger(),
  id_partner: nonNegativeInteger(),
  id_ag_export: nonNegativeInteger(),
  id_ag_import: nonNegativeInteger(),
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
  locked: ((field: keyof Cargo) => boolean) | undefined,
  t: Translate,
): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};
  for (const key of Object.keys(patch) as (keyof Cargo)[]) {
    if (locked?.(key)) continue;
    const rule = cargoRules[key];
    if (!rule) continue;
    const reason = rule(patch[key]);
    if (reason) {
      errors[key as string] = t(reason, { label: t(`cargo.validation.fields.${String(key)}`) });
    }
  }
  return errors;
}
