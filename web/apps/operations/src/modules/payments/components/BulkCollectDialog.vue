<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1">{{
        t("payments.bulk.title")
      }}</v-card-title>
      <v-card-text>
        <div class="text-body-2 mb-3">
          {{
            t("payments.bulk.summary", {
              count: rows.length,
              amount: money(totalAmount),
            })
          }}
        </div>
        <v-text-field
          v-model="date"
          type="date"
          :label="t('payments.collect.date')"
          density="comfortable"
          variant="outlined"
          :rules="[(v) => !!v || t('common.required')]"
        />
        <p class="text-caption text-medium-emphasis">
          {{ t("payments.bulk.all_or_nothing") }}
        </p>

        <v-alert
          v-if="errors.length"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          <div class="font-weight-medium mb-1">
            {{ t("payments.bulk.errors_title") }}
          </div>
          <ul class="bulk-errors">
            <li v-for="e in errors" :key="e.id">
              <strong>{{ labelOf(e.id) }}</strong
              >: {{ e.reason }}
            </li>
          </ul>
        </v-alert>
        <v-alert
          v-else-if="failure"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ failure }}
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
          :disabled="!date || !rows.length"
          @click="submit"
        >
          {{ t("payments.bulk.submit") }}
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
import type { BulkErrorItem, PaymentRow } from "../types";

const props = defineProps<{ modelValue: boolean; rows: PaymentRow[] }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; collected: [] }>();

const { t } = useI18n();
const toasts = useToastStore();

const date = ref(today());
const saving = ref(false);
const errors = ref<BulkErrorItem[]>([]);
const failure = ref("");

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    date.value = today();
    errors.value = [];
    failure.value = "";
  },
);

const totalAmount = computed(() =>
  props.rows.reduce((s, r) => s + r.importo, 0),
);

function money(v: number): string {
  return Number(v).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function labelOf(id: number): string {
  const r = props.rows.find((x) => x.id === id);
  return r ? `${r.numero} · ${r.rag_soc}` : `#${id}`;
}

async function submit(): Promise<void> {
  saving.value = true;
  errors.value = [];
  failure.value = "";
  try {
    const res = await paymentsApi.bulkCollect(
      props.rows.map((r) => r.id),
      date.value,
    );
    if (res.ok) {
      toasts.push(
        "success",
        t("payments.bulk.done", { count: props.rows.length }),
      );
      emit("collected");
      emit("update:modelValue", false);
    } else {
      errors.value = res.errors;
      if (!res.errors.length)
        failure.value = res.message ?? t("payments.bulk.failed");
    }
  } catch (e) {
    // 409 u otro fallo: no se ha cerrado ninguna cuota.
    failure.value = e instanceof Error ? e.message : t("payments.bulk.failed");
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.bulk-errors {
  margin: 0;
  padding-left: 18px;
}
</style>
