<template>
  <ModalWrapper
    name="tact_detail"
    :title="t('cargo.modal.tact')"
    icon="mdi-airplane"
    :max-width="600"
  >
    <div v-if="loading" class="text-center py-4">
      <v-progress-circular indeterminate color="primary" />
      <div class="text-caption text-medium-emphasis mt-2">
        {{ t("cargo.tact.consulting") }}
      </div>
    </div>

    <template v-else-if="result?.success && result.data">
      <v-row dense>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.tact.carrier_matched") }}
          </div>
          <div class="text-body-2 font-weight-medium">
            {{ result.data.carrier_matched ?? "—" }}
          </div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.tact.rate_type") }}
          </div>
          <div class="text-body-2 font-weight-medium">
            {{ result.data.rate_type ?? "—" }}
          </div>
        </v-col>
        <v-col cols="6" sm="4">
          <div class="text-caption text-medium-emphasis">TACT</div>
          <div class="text-h6 font-weight-bold">
            {{ result.data.currency_code ?? "USD" }}
            {{ Number(result.data.tact ?? 0).toFixed(2) }}
          </div>
        </v-col>
        <v-col cols="6" sm="4">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.flight.min_charge") }}
          </div>
          <div class="text-body-2 font-weight-medium">
            {{ Number(result.data.minimum_charge ?? 0).toFixed(2) }}
          </div>
        </v-col>
        <v-col cols="6" sm="4">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.tact.weight_charge") }}
          </div>
          <div class="text-body-2 font-weight-medium">
            {{ Number(result.data.weight_charge ?? 0).toFixed(2) }}
          </div>
        </v-col>
        <v-col v-if="result.data.effective_date" cols="12">
          <div class="text-caption text-medium-emphasis">
            {{
              t("cargo.tact.effective_from", {
                date: result.data.effective_date,
              })
            }}
          </div>
        </v-col>
      </v-row>
    </template>

    <template
      v-else-if="
        result && !result.success && result.error_code === 'TACT_NO_RATE'
      "
    >
      <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
        {{ t("cargo.tact.no_rate") }}
      </v-alert>
      <div v-if="result.details" class="mb-2">
        <div class="text-caption text-medium-emphasis">
          {{ t("cargo.tact.requested_route") }}
        </div>
        <div class="text-body-2">
          {{ result.details.origin ?? "?" }} →
          {{ result.details.destination ?? "?" }}
          <span
            v-if="result.details.requested_carrier"
            class="text-medium-emphasis"
          >
            · {{ result.details.requested_carrier }}
          </span>
        </div>
      </div>
      <template v-if="(result.details?.available_carriers?.length ?? 0) > 0">
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t("cargo.tact.alt_carriers") }}
        </div>
        <div class="d-flex flex-wrap ga-1">
          <v-chip
            v-for="c in result.details?.available_carriers ?? []"
            :key="c"
            size="small"
            variant="outlined"
            class="cursor-pointer"
            @click="lookup(c)"
          >
            {{ c }}
          </v-chip>
        </div>
      </template>
    </template>

    <v-alert
      v-else-if="result?.error"
      type="error"
      variant="tonal"
      density="compact"
    >
      {{ result.error }}
    </v-alert>

    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
      <v-btn
        prepend-icon="mdi-refresh"
        variant="outlined"
        :loading="loading"
        :disabled="!cargoId"
        @click="lookup()"
      >
        {{ t("cargo.tact.reconsult") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import {
  tactService,
  type TactLookupResponse,
} from "@cargo/services/tact.service";
import ModalWrapper from "./ModalWrapper.vue";

const { t } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const toasts = useToastStore();
const { id } = storeToRefs(cargoStore);

const cargoId = computed<number | null>(() => {
  if (!id.value) return null;
  const n = Number(id.value);
  return Number.isFinite(n) ? n : null;
});

const result = ref<TactLookupResponse | null>(null);
const loading = ref(false);

watch(
  () => ui.activeModal,
  (n) => {
    if (n === "tact_detail") void lookup();
  },
);

async function lookup(carrier?: string): Promise<void> {
  if (!cargoId.value) return;
  loading.value = true;
  try {
    result.value = await tactService.lookup({
      shipmentId: cargoId.value,
      carrier,
    });
    if (!result.value.success && result.value.error_code !== "TACT_NO_RATE") {
      toasts.push("error", result.value.error ?? t("cargo.tact.lookup_failed"));
    }
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
