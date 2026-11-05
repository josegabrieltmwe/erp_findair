<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    persistent
    @update:model-value="onToggle"
  >
    <v-card>
      <v-card-title class="text-subtitle-1">
        {{ t("payments.surcharges.propose.title") }}
      </v-card-title>

      <v-card-text>
        <div class="text-body-2 text-medium-emphasis mb-3">
          {{ t("payments.surcharges.propose.hint") }}
        </div>

        <!-- Solo clientes del propio partner: un cliente ajeno responde 404 en el API. -->
        <CustomerPicker
          v-model="form.customerId"
          :label="t('payments.list.customer')"
          class="mb-3"
        />
        <div v-if="shown('customer')" class="text-caption text-error mb-2">
          {{ t("payments.surcharges.propose.errors.customer") }}
        </div>

        <v-select
          v-model="form.type"
          :items="typeItems"
          :label="t('payments.surcharges.propose.type')"
          variant="outlined"
          density="comfortable"
          class="mb-1"
          data-testid="propose-type"
        />

        <v-text-field
          v-model="form.amount"
          inputmode="decimal"
          suffix="EUR"
          :label="t('payments.surcharges.propose.amount')"
          :hint="t('payments.surcharges.propose.amount_hint')"
          persistent-hint
          :error-messages="shown('amount') ? [t('payments.surcharges.propose.errors.amount')] : []"
          variant="outlined"
          density="comfortable"
          class="mb-1"
          data-testid="propose-amount"
        />

        <!-- Valor declarado y medido: obligatorios en sobrepeso y oversize. -->
        <div v-if="needsMeasures" class="d-flex ga-3">
          <v-text-field
            v-model="form.declared"
            :label="t('payments.surcharges.propose.declared')"
            :error-messages="shown('declared') ? [t('payments.surcharges.propose.errors.declared')] : []"
            variant="outlined"
            density="comfortable"
            data-testid="propose-declared"
          />
          <v-text-field
            v-model="form.measured"
            :label="t('payments.surcharges.propose.measured')"
            :error-messages="shown('measured') ? [t('payments.surcharges.propose.errors.measured')] : []"
            variant="outlined"
            density="comfortable"
            data-testid="propose-measured"
          />
        </div>

        <v-text-field
          v-model="form.carrierRef"
          :label="t('payments.surcharges.propose.carrier_ref')"
          variant="outlined"
          density="comfortable"
          class="mb-1"
        />

        <v-textarea
          v-model="form.evidence"
          :label="t('payments.surcharges.propose.evidence')"
          :error-messages="shown('evidence') ? [t('payments.surcharges.propose.errors.evidence')] : []"
          rows="3"
          auto-grow
          variant="outlined"
          density="comfortable"
          data-testid="propose-evidence"
        />

        <v-alert
          v-if="errorKind"
          type="error"
          variant="tonal"
          density="compact"
          data-testid="propose-error"
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
          color="primary"
          :loading="saving"
          data-testid="propose-submit"
          @click="submit"
        >
          {{ t("payments.surcharges.propose.submit") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Proponer un recargo a un cliente del partner (sobrepeso, oversize u otros). El recargo nace en `pending_notice`: no se
 * avisa ni se cobra nada hasta que otra acción lo avise (y, pasado el preaviso, lo cobre). Pide motivo y evidencia del
 * transportista; en sobrepeso y oversize también el valor declarado y el medido.
 *
 * Importe: la persona escribe euros ("42,50") y el servicio recibe el ENTERO en céntimos (4250). Los topes (150 EUR por
 * cobro y 500 EUR al mes por cliente por defecto) y que no superen lo que aceptó el cliente los valida el servidor:
 * son parámetros del vendedor y se explican por el código del error (`SURCHARGE_CAP_EXCEEDED`), no se duplican aquí.
 * Sin autorización activa del cliente, el API responde 409 `PAYMENT_INVALID_STATE` (se usa la autorización activa del cliente).
 *
 * Idempotente por hecho medido (envío + tipo + evidencia): repetir la propuesta devuelve la existente (`replayed`) y se
 * avisa de que ya existía. Con el interruptor del servidor apagado responde 503 `PAYMENT_NOT_ACTIVE`.
 *
 * Permiso: `payment_gateways:write` (lo comprueba la página antes de ofrecer el botón). Eventos: `update:modelValue` y
 * `done` (propuesta creada o repetida; la página recarga la lista). La validación pura vive en `surchargesModel.ts`.
 */
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  PAY_SURCHARGE_TYPES,
  paySurcharges,
} from "@shared/payment_gateways/services/paymentGateways.service";
import { useToastStore } from "../stores/toast.store";
import CustomerPicker from "./CustomerPicker.vue";
import {
  classifySurchargeError,
  eurosToMinor,
  validateProposal,
  type ProposeFieldError,
  type ProposeForm,
  type SurchargeErrorKind,
} from "./surchargesModel";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  done: [];
}>();

const { t } = useI18n();
const toasts = useToastStore();

function emptyForm(): ProposeForm {
  return { customerId: null, type: "overweight", amount: "", declared: "", measured: "", evidence: "", carrierRef: "" };
}

const form = reactive<ProposeForm>(emptyForm());
const saving = ref(false);
const errorKind = ref<SurchargeErrorKind | null>(null);
/** Los errores de campo solo se pintan tras el primer intento de enviar (no mientras se escribe). */
const attempted = ref(false);

const typeItems = computed(() =>
  PAY_SURCHARGE_TYPES.map((v) => ({ value: v, title: t(`payments.surcharges.type.${v}`) })),
);
const needsMeasures = computed(() => form.type === "overweight" || form.type === "oversize");
const fieldErrors = computed<ProposeFieldError[]>(() => validateProposal(form));

function shown(field: ProposeFieldError): boolean {
  return attempted.value && fieldErrors.value.includes(field);
}

// Cada apertura empieza con el formulario limpio.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    Object.assign(form, emptyForm());
    attempted.value = false;
    errorKind.value = null;
    saving.value = false;
  },
);

async function submit(): Promise<void> {
  attempted.value = true;
  errorKind.value = null;
  if (fieldErrors.value.length > 0 || form.customerId === null) return;
  const minor = eurosToMinor(form.amount);
  if (minor === null) return;
  saving.value = true;
  try {
    const res = await paySurcharges.propose({
      customer_id: form.customerId,
      surcharge_type: form.type,
      amount_minor: minor,
      declared_value: needsMeasures.value ? form.declared.trim() : undefined,
      measured_value: needsMeasures.value ? form.measured.trim() : undefined,
      evidence: form.evidence.trim(),
      carrier_ref: form.carrierRef.trim() || undefined,
    });
    toasts.push(res.replayed ? "info" : "success", t(res.replayed ? "payments.surcharges.done.propose_replayed" : "payments.surcharges.done.propose"));
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
