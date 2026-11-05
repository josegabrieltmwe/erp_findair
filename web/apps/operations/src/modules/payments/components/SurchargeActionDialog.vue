<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    persistent
    @update:model-value="onToggle"
  >
    <v-card v-if="action && surcharge">
      <v-card-title class="text-subtitle-1">
        {{ t(`payments.surcharges.confirm.${action}.title`) }}
      </v-card-title>

      <v-card-text>
        <!-- Resumen del recargo sobre el que se actúa: evita equivocarse de fila. -->
        <div class="text-body-2 mb-2" data-testid="surcharge-action-summary">
          <span class="font-weight-medium">{{ surcharge.public_id }}</span>
          ·
          {{ t(`payments.surcharges.type.${surcharge.surcharge_type}`) }}
          ·
          <strong>{{ formatMinor(surcharge.amount_minor, surcharge.currency) }}</strong>
        </div>
        <div class="text-body-2 text-medium-emphasis mb-3">
          {{ t(`payments.surcharges.confirm.${action}.body`) }}
        </div>

        <!-- Motivo: obligatorio para impugnar y perdonar (el API responde 422 sin él). -->
        <v-textarea
          v-if="needsReason"
          v-model="reason"
          :label="t('payments.surcharges.reason')"
          :counter="REASON_MAX"
          :maxlength="REASON_MAX"
          rows="3"
          auto-grow
          variant="outlined"
          density="comfortable"
          data-testid="surcharge-action-reason"
        />

        <v-alert
          v-if="errorKind"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-2"
          data-testid="surcharge-action-error"
        >
          {{ t(`payments.surcharges.errors.${errorKind}`) }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="close">
          {{ t("common.cancel") }}
        </v-btn>
        <v-btn
          :color="action === 'waive' ? 'warning' : 'primary'"
          :loading="saving"
          :disabled="!canSubmit"
          data-testid="surcharge-action-submit"
          @click="submit"
        >
          {{ t(`payments.surcharges.action.${action}`) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Confirmación y ejecución de UNA acción sobre un recargo: avisar al cliente, impugnar en su nombre, perdonar, rechazar
 * una impugnación o cobrar. Un único diálogo para las cinco porque comparten forma (resumen, motivo opcional, error) y así
 * ninguna acción se lanza con un clic suelto: todas piden confirmación, y las que mueven dinero o cierran el caso
 * (`waive`, `reject_dispute`, `charge`) dejan claro qué harán.
 *
 * Props: `modelValue` abre/cierra; `action` es la acción elegida (`notify|dispute|waive|reject_dispute|charge`);
 * `surcharge` el recargo de la fila. Eventos: `update:modelValue` y `done` (acción aplicada; la página recarga la lista).
 *
 * Permisos: el diálogo NO decide quién puede; la página solo abre las acciones que `availableActions` ofrece según los
 * scopes (`:write` para avisar/impugnar, `:admin` para el resto). El API autoriza igualmente: un 403 `PAYMENT_FORBIDDEN`
 * (p. ej. `payment_gateways:admin` sin ser TMWE ni `partner:manage`) se muestra como aviso, no como fallo interno.
 *
 * Reglas de negocio que se explican por código de error (`classifySurchargeError`): 409 de preaviso sin vencer, de plazo de
 * impugnación cerrado o de pago en curso; 503 `PAYMENT_NOT_ACTIVE` cuando el interruptor del servidor está apagado
 * (avisar y cobrar dependen de él; impugnar, perdonar y rechazar no).
 *
 * El motivo es obligatorio en `dispute` y `waive` (máx. 255 caracteres). Un doble clic no duplica la acción: el botón
 * queda en carga y, además, el API es idempotente en `notify`/`dispute`/`waive` (responde `replayed`).
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  paySurcharges,
  type PaySurcharge,
  type PaySurchargeActionResult,
} from "@shared/payment_gateways/services/paymentGateways.service";
import { useToastStore } from "../stores/toast.store";
import {
  chargeResultKey,
  classifySurchargeError,
  formatMinor,
  type SurchargeAction,
  type SurchargeErrorKind,
} from "./surchargesModel";

const props = defineProps<{
  modelValue: boolean;
  action: SurchargeAction | null;
  surcharge: PaySurcharge | null;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  done: [];
}>();

const { t } = useI18n();
const toasts = useToastStore();

/** Longitud máxima del motivo que acepta el API. */
const REASON_MAX = 255;

const reason = ref("");
const saving = ref(false);
const errorKind = ref<SurchargeErrorKind | null>(null);

/** Impugnar y perdonar exigen motivo. */
const needsReason = computed(() => props.action === "dispute" || props.action === "waive");
const canSubmit = computed(
  () => !saving.value && (!needsReason.value || reason.value.trim() !== ""),
);

// Cada apertura empieza limpia.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    reason.value = "";
    errorKind.value = null;
    saving.value = false;
  },
);

/** Llama a la acción del servicio que corresponde. */
async function run(action: SurchargeAction, id: string): Promise<PaySurchargeActionResult> {
  switch (action) {
    case "notify":
      return paySurcharges.notify(id);
    case "dispute":
      return paySurcharges.dispute(id, reason.value.trim());
    case "waive":
      return paySurcharges.waive(id, reason.value.trim());
    case "reject_dispute":
      return paySurcharges.rejectDispute(id);
    default:
      return paySurcharges.charge(id);
  }
}

/** Texto del aviso de éxito según la acción y su resultado. */
function successMessage(action: SurchargeAction, res: PaySurchargeActionResult): string {
  if (action === "waive" && res.refundRequested) return t("payments.surcharges.done.waive_refund");
  if (action === "charge" || action === "reject_dispute") {
    return t(`payments.surcharges.result.${chargeResultKey(res.result)}`);
  }
  return t(`payments.surcharges.done.${action}`);
}

async function submit(): Promise<void> {
  if (!props.action || !props.surcharge || !canSubmit.value) return;
  saving.value = true;
  errorKind.value = null;
  try {
    const res = await run(props.action, props.surcharge.public_id);
    const ok = (props.action !== "charge" && props.action !== "reject_dispute") || res.result === "charged";
    toasts.push(ok ? "success" : "info", successMessage(props.action, res));
    emit("done");
    emit("update:modelValue", false);
  } catch (e) {
    errorKind.value = classifySurchargeError(e);
  } finally {
    saving.value = false;
  }
}

function close(): void {
  if (saving.value) return;
  emit("update:modelValue", false);
}

function onToggle(v: boolean): void {
  if (!v) close();
}
</script>
