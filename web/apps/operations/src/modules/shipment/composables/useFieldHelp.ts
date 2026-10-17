import { useI18n } from "vue-i18n";
import { fieldHelpService } from "@shipment/services/field_help.service";
import {
  useFieldHelp as useFieldHelpShared,
  type FieldHelp,
} from "@tmwe/shared-frontend/composables/useFieldHelp";

/** Legacy express/courier form id in forms_campi. */
const EXPRESS_FORM_ID = "31";

/**
 * Express wrapper around the shared field-help composable. Injects the express
 * form id ('31') and the active SPA language (itxt parity: it/en).
 */
export function useFieldHelp(): FieldHelp {
  const { locale } = useI18n();
  return useFieldHelpShared({
    formId: EXPRESS_FORM_ID,
    fetcher: (formId) => fieldHelpService.map(formId, String(locale.value)),
  });
}
