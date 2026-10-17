<template>
  <div class="d-flex ga-2 align-center flex-grow-1">
    <!-- TACT rate + lookup ► + details "i" — paridad con legacy widget Vue
         montado sobre `cmqY_TACT_x10` (spedyc_form.php:3248-3277). -->
    <v-text-field
      :model-value="modelValueStr"
      :label="t('cargo.mawbv2.tact_rate')"
      type="number"
      step="0.01"
      density="compact"
      variant="outlined"
      hide-details
      :disabled="disabled"
      class="flex-grow-1"
      @change="(v: string) => emit('update:tact', v === '' ? null : Number(v))"
    >
      <template #append-inner>
        <v-btn
          icon
          size="x-small"
          variant="text"
          density="comfortable"
          :loading="loading"
          :disabled="disabled || loading"
          :title="t('cargo.mawbv2.tact_lookup')"
          @click.stop="runLookup"
        >
          <v-icon icon="mdi-play" size="18" color="primary" />
        </v-btn>
        <v-btn
          v-if="details"
          icon
          size="x-small"
          variant="text"
          density="comfortable"
          :title="t('cargo.mawbv2.tact_details')"
          @click.stop="showDetails = !showDetails"
        >
          <v-icon icon="mdi-information-outline" size="18" />
        </v-btn>
      </template>
    </v-text-field>
  </div>

  <!-- Rate details drop-down (only after a successful lookup) -->
  <v-expand-transition>
    <v-sheet
      v-if="details && showDetails"
      color="surface-light"
      rounded
      class="pa-2 mt-1 text-caption"
    >
      <div class="d-flex flex-wrap ga-3">
        <span
          ><strong>{{ t("cargo.mawbv2.tact_rate") }}:</strong>
          {{ details.tact }} {{ details.currency_code ?? "" }}</span
        >
        <span
          ><strong>{{ t("cargo.mawbv2.tact_min_charge") }}:</strong>
          {{ details.minimum_charge }}</span
        >
        <span v-if="details.weight_charge != null"
          ><strong>{{ t("cargo.mawbv2.tact_weight_charge") }}:</strong>
          {{ details.weight_charge }}</span
        >
        <span v-if="details.carrier_matched"
          ><strong>{{ t("cargo.mawbv2.tact_carrier") }}:</strong>
          {{ details.carrier_matched }}</span
        >
        <span v-if="details.rate_type"
          ><strong>{{ t("cargo.mawbv2.tact_type") }}:</strong>
          {{ details.rate_type }}</span
        >
        <span v-if="details.effective_date"
          ><strong>{{ t("cargo.mawbv2.tact_effective_date") }}:</strong>
          {{ details.effective_date }}</span
        >
      </div>
    </v-sheet>
  </v-expand-transition>

  <!-- No-rate dialog: requested carrier has no rate on this route -->
  <AppDialog
    :open="noRateOpen"
    :title="t('cargo.mawbv2.tact_no_rate_title')"
    icon="mdi-airplane-alert"
    icon-color="warning"
    size="md"
    @close="noRateOpen = false"
    @update:model-value="(v: boolean) => (noRateOpen = v)"
  >
    <p class="mb-2">
      {{
        t("cargo.mawbv2.tact_no_rate_body", {
          carrier: noRate?.requested_carrier ?? "—",
          origin: noRate?.origin ?? "—",
          destination: noRate?.destination ?? "—",
        })
      }}
    </p>
    <template v-if="(noRate?.available_carriers?.length ?? 0) > 0">
      <p class="text-subtitle-2 mb-1">
        {{ t("cargo.mawbv2.tact_alt_carriers") }}
      </p>
      <v-list density="compact" class="py-0">
        <v-list-item
          v-for="(c, i) in noRate?.available_carriers ?? []"
          :key="i"
          :title="c.carrier_name ?? c.carrier_code ?? String(c)"
          :subtitle="c.carrier_code ?? undefined"
          prepend-icon="mdi-airplane"
        />
      </v-list>
    </template>
    <p v-else class="text-medium-emphasis">
      {{ t("cargo.mawbv2.tact_no_alt_carriers") }}
    </p>
    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="noRateOpen = false">
        {{ t("common.close") }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";
import { ApiError } from "@tmwe/shared-frontend/http";
import { cargoMawbService } from "@cargo/services/cargo_mawb.service";
import { useToastStore } from "@cargo/stores/toast.store";
import type {
  TactRateResult,
  TactNoRateDetails,
} from "@cargo/services/cargo_mawb.types";

const props = defineProps<{
  cargoId: number;
  tact: string | number | null | undefined;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:tact", value: number | null): void;
  /** Fired after a successful lookup so the parent can reload the MAWB row. */
  (e: "looked-up", result: TactRateResult): void;
}>();

const { t } = useI18n();
const toasts = useToastStore();

const loading = ref(false);
const details = ref<TactRateResult | null>(null);
const showDetails = ref(false);
const noRate = ref<TactNoRateDetails | null>(null);
const noRateOpen = ref(false);

const modelValueStr = computed<string>(() =>
  props.tact == null || props.tact === "" ? "" : String(props.tact),
);

async function runLookup(): Promise<void> {
  if (props.disabled || loading.value || !props.cargoId) return;
  loading.value = true;
  try {
    const result = await cargoMawbService.tactLookup(props.cargoId);
    details.value = result;
    showDetails.value = true;
    emit("update:tact", result.tact);
    emit("looked-up", result);
  } catch (e) {
    if (e instanceof ApiError && e.errorCode === "TACT_NO_RATE") {
      const payload = e.payload as { details?: TactNoRateDetails } | undefined;
      noRate.value = payload?.details ?? null;
      noRateOpen.value = true;
    } else {
      toasts.push("error", (e as Error).message);
    }
  } finally {
    loading.value = false;
  }
}
</script>
