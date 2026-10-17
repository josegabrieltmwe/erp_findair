import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shipment/stores/toast.store";
import {
  labelsService,
  type ValidationIssue,
} from "@shipment/services/labels.service";

/**
 * Courier AWB generation flow (pre-flight validation + booking), extracted from
 * ServizioCard. Owns the confirm dialog's state and the ship-date preview.
 * Behaviour is unchanged.
 *
 * @param shipmentId  reactive getter for the current shipment id
 * @param shipDateRaw reactive getter for the raw `data_sped0` value
 * @param onGenerated called with the new tracking number once booking succeeds
 *                    (the card wires this to the success-dialog hand-off)
 */
export function useAwbGeneration(
  shipmentId: () => number,
  shipDateRaw: () => string,
  onGenerated: (tracking: string) => void,
) {
  const { t } = useI18n();
  const toasts = useToastStore();

  const dialogOpen = ref(false);
  const generating = ref(false);

  // Pre-flight validation, run automatically when the confirm dialog opens.
  const validating = ref(false);
  const errors = ref<ValidationIssue[]>([]);
  const warnings = ref<ValidationIssue[]>([]);
  const hasBlockingErrors = computed<boolean>(() => errors.value.length > 0);

  // Re-implements the backend's `validate_and_adjust_shipment_date` heuristic
  // in JS so the operator sees up-front whether the date will be adjusted.
  const shipDateAdjusted = computed<boolean>(() => {
    const raw = shipDateRaw();
    if (!raw) return true;
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return true;
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(dt.getTime())) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dt.getTime() < today.getTime();
  });

  const shipDateLabel = computed<string>(() => {
    const raw = shipDateRaw();
    if (!raw) return "—";
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return raw;
    return `${m[3]}/${m[2]}/${m[1]}`;
  });

  /**
   * Open the confirm dialog and kick off pre-flight validation. Callers pass
   * whether a courier is assigned (guard: no fornitore → warn, don't open).
   */
  function confirm(hasCourier: boolean): void {
    if (!hasCourier) {
      toasts.push("warning", t("shipment.awb.toast_assign_fornitore_first"));
      return;
    }
    dialogOpen.value = true;
    void runValidation();
  }

  async function runValidation(): Promise<void> {
    const sid = shipmentId();
    if (!sid) return;
    validating.value = true;
    errors.value = [];
    warnings.value = [];
    try {
      const r = await labelsService.validate(sid);
      if (!r.success) {
        // A failed validation call itself is treated as a blocking error.
        errors.value = [
          {
            category: "system",
            severity: "error",
            message: r.error ?? t("shipment.awb.val_check_failed"),
          },
        ];
        return;
      }
      errors.value = r.errors ?? [];
      warnings.value = r.warnings ?? [];
    } catch (e) {
      errors.value = [
        {
          category: "system",
          severity: "error",
          message: (e as Error).message,
        },
      ];
    } finally {
      validating.value = false;
    }
  }

  async function generate(): Promise<void> {
    const sid = shipmentId();
    if (!sid) return;
    generating.value = true;
    try {
      // Note: test/prod is NOT chosen here. The backend derives it from the
      // courier account's `testing` flag (set by the system admin); the operator
      // never picks the sandbox per booking.
      const r = await labelsService.generateCourierLabel(sid, {
        force_courier: true,
        convert_to_jpg: true,
      });

      if (!r.success) {
        const msg =
          typeof r.error === "string"
            ? r.error
            : (r.error?.message ?? t("shipment.awb.toast_generate_failed"));
        toasts.push(
          "error",
          t("shipment.awb.toast_awb_not_generated", { msg }),
        );
        return;
      }

      const data = r.data;
      if (!data || !data.master_tracking_number) {
        // Backend reported success but the worker timed out / responded empty
        // (the controller logs this as labels_count:0). Surface it explicitly
        // instead of silently closing the dialog.
        toasts.push("warning", t("shipment.awb.toast_courier_timeout"));
        return;
      }

      toasts.push(
        "success",
        t("shipment.awb.toast_awb_generated", {
          tracking: data.master_tracking_number,
        }),
      );
      dialogOpen.value = false;
      onGenerated(data.master_tracking_number);
    } catch (e) {
      toasts.push("error", (e as Error).message);
    } finally {
      generating.value = false;
    }
  }

  return {
    dialogOpen,
    generating,
    validating,
    errors,
    warnings,
    hasBlockingErrors,
    shipDateAdjusted,
    shipDateLabel,
    confirm,
    generate,
  };
}
