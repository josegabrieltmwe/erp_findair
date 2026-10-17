<template>
  <ModalWrapper
    name="currency_day"
    :title="t('cargo.modal.currency_day')"
    icon="mdi-currency-eur"
    :max-width="560"
  >
    <div class="d-flex align-center gap-2 mb-3">
      <v-text-field
        v-model="date"
        type="date"
        :label="t('cargo.dates.title_single')"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 200px"
        @update:model-value="load"
      />
      <v-chip
        v-if="payload?.is_fallback"
        size="small"
        color="warning"
        variant="tonal"
      >
        {{ t("cargo.currency.fallback", { date: payload?.effective_date }) }}
      </v-chip>
    </div>

    <v-progress-linear v-if="loading" indeterminate class="mb-2" />

    <v-alert
      v-else-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      {{ error }}
    </v-alert>

    <v-table v-else density="compact" class="currency-table">
      <thead>
        <tr>
          <th>{{ t("cargo.currency.code") }}</th>
          <th>{{ t("cargo.col.currency") }}</th>
          <th class="text-end">1 EUR =</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rates" :key="r.sigla">
          <td class="font-weight-medium">{{ r.sigla }}</td>
          <td class="text-medium-emphasis">{{ r.nome }}</td>
          <td class="text-end metric-mono">
            {{ r.rate_per_eur != null ? r.rate_per_eur : "—" }}
          </td>
        </tr>
        <tr v-if="rates.length === 0">
          <td colspan="3" class="text-center text-medium-emphasis py-4">
            {{ t("cargo.currency.none") }}
          </td>
        </tr>
      </tbody>
    </v-table>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import {
  currencyService,
  type CurrencyDayPayload,
  type CurrencyRate,
} from "@cargo/services/currency.service";
import ModalWrapper from "./ModalWrapper.vue";

const { t } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const { cargo } = storeToRefs(cargoStore);

// Default to the cargo's reference date (legacy currency_day_box.php used
// data_sped0); fall back to today via an empty query.
const initialDate = (): string => {
  const raw = cargo.value?.data_sped0 as string | undefined;
  if (raw && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return "";
};

const date = ref<string>(initialDate());
const payload = ref<CurrencyDayPayload | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const rates = computed<CurrencyRate[]>(() => payload.value?.rates ?? []);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await currencyService.getDayRates(date.value || undefined);
    if (res.success && res.data) {
      payload.value = res.data;
    } else {
      error.value = res.error ?? t("cargo.currency.load_failed");
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

// Lazily load when the modal opens (and seed the date from the cargo).
watch(
  () => ui.activeModal,
  (m) => {
    if (m === "currency_day") {
      if (!date.value) date.value = initialDate();
      void load();
    }
  },
);
</script>

<style scoped>
.metric-mono {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
.gap-2 {
  gap: 8px;
}
</style>
