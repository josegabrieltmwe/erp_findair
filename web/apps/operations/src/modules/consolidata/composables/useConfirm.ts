import { useI18n } from "vue-i18n";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";

/** Confirmación con el diálogo de la aplicación (AppConfirmHost), no `window.confirm` (E7). */
export function useConsolidataConfirm() {
  const confirm = useConfirmStore();
  const { t } = useI18n();
  return (message: string, danger = false): Promise<boolean> =>
    confirm.ask({
      title: t("consolidata.confirm.title"),
      message,
      confirmLabel: t("consolidata.common.confirm"),
      cancelLabel: t("consolidata.common.cancel"),
      variant: danger ? "danger" : "default",
    });
}
