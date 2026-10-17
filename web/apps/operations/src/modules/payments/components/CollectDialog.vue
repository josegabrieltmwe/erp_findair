<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card v-if="payment">
      <v-card-title class="text-subtitle-1">
        {{ t("payments.collect.title") }}
      </v-card-title>
      <v-card-text>
        <div class="text-body-2 text-medium-emphasis mb-3">
          {{ installmentInfo }}
        </div>

        <v-radio-group v-model="mode" inline density="comfortable" hide-details>
          <v-radio :label="t('payments.collect.full')" value="full" />
          <v-radio :label="t('payments.collect.partial')" value="partial" />
        </v-radio-group>

        <v-text-field
          v-model="date"
          type="date"
          :label="t('payments.collect.date')"
          density="comfortable"
          variant="outlined"
          class="mt-3"
          :rules="[(v) => !!v || t('common.required')]"
        />
        <v-text-field
          v-if="mode === 'partial'"
          v-model.number="amount"
          type="number"
          step="0.01"
          min="0"
          :label="t('payments.collect.amount')"
          density="comfortable"
          variant="outlined"
          :error-messages="amountMessage"
        />
        <v-select
          v-model="methodId"
          :items="methods"
          item-title="label"
          item-value="id"
          :label="t('payments.collect.method')"
          density="comfortable"
          variant="outlined"
          clearable
          hide-details
        />
        <v-alert
          v-if="mode === 'partial' && !amountError"
          type="info"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ t("payments.collect.remainder", { amount: money(remainder) }) }}
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t("common.cancel") }}
        </v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ t("payments.collect.submit") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { paymentsApi, today } from "../services/payments.service";
import { useToastStore } from "../stores/toast.store";
import type { PaymentMethod } from "../types";
import { remainderOf, validatePartialAmount } from "./collectModel";

/** Cuota a cobrar (válida tanto para filas del listado como de una factura). */
export interface CollectTarget {
  id: number;
  importo: number;
  scadenza: string;
  id_pagam_metodi?: number | null;
}

const props = defineProps<{
  modelValue: boolean;
  payment: CollectTarget | null;
  methods: PaymentMethod[];
  currency?: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  collected: [];
}>();

const { t } = useI18n();
const toasts = useToastStore();

const mode = ref<"full" | "partial">("full");
const date = ref(today());
const amount = ref<number | null>(null);
const methodId = ref<number | null>(null);
const saving = ref(false);

watch(
  () => [props.modelValue, props.payment?.id] as const,
  ([open]) => {
    if (!open) return;
    mode.value = "full";
    date.value = today();
    amount.value = null;
    methodId.value = props.payment?.id_pagam_metodi ?? null;
  },
);

const total = computed(() => Number(props.payment?.importo ?? 0));
const amountError = computed(() =>
  mode.value === "partial"
    ? validatePartialAmount(amount.value, total.value)
    : null,
);
const amountMessage = computed(() => {
  if (!amountError.value) return [];
  // Sin importe todavía no se muestra el error, solo se bloquea el botón.
  if (amountError.value === "required") return [];
  return [
    t(`payments.collect.errors.${amountError.value}`, {
      max: money(total.value),
    }),
  ];
});
const installmentInfo = computed(() =>
  t("payments.collect.installment_info", {
    amount: money(total.value),
    date: props.payment?.scadenza ?? "",
  }),
);
const remainder = computed(() => remainderOf(amount.value, total.value));
const canSubmit = computed(() => !!date.value && !amountError.value);

function money(v: number): string {
  const n = Number(v ?? 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return props.currency ? `${n} ${props.currency}` : n;
}

async function submit(): Promise<void> {
  if (!props.payment || !canSubmit.value) return;
  saving.value = true;
  try {
    await paymentsApi.register({
      id: props.payment.id,
      date: date.value,
      amount: mode.value === "partial" ? (amount.value as number) : undefined,
      id_pagam_metodi: methodId.value,
    });
    toasts.push(
      "success",
      t(
        mode.value === "partial"
          ? "payments.collect.done_partial"
          : "payments.collect.done",
      ),
    );
    emit("collected");
    emit("update:modelValue", false);
  } catch (e) {
    toasts.push("error", e instanceof Error ? e.message : String(e));
  } finally {
    saving.value = false;
  }
}
</script>
