import { useI18n } from "vue-i18n";
import { fieldHelpService } from "@cargo/services/field_help.service";
import {
  useFieldHelp as useFieldHelpShared,
  type FieldHelp,
} from "@tmwe/shared-frontend/composables/useFieldHelp";

/** Legacy cargo form id in forms_campi. */
const CARGO_FORM_ID = "40";

/**
 * Cargo wrapper around the shared field-help composable. Injects the cargo
 * form id ('40') and the active SPA language (itxt parity: it/en).
 */
export function useFieldHelp(): FieldHelp {
  const { locale } = useI18n();
  return useFieldHelpShared({
    formId: CARGO_FORM_ID,
    fetcher: (formId) => fieldHelpService.map(formId, String(locale.value)),
  });
}
