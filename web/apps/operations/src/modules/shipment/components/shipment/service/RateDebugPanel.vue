<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center text-subtitle-1">
        <v-icon icon="mdi-calculator-variant-outline" class="me-2" size="20" />
        {{ t("shipment.service.debug.title", { service: serviceName }) }}
        <v-spacer />
        <v-chip v-if="trace" size="x-small" variant="tonal">{{
          t("shipment.service.debug.steps", { count: trace.steps.length })
        }}</v-chip>
        <v-btn
          icon="$close"
          variant="text"
          size="small"
          class="ms-1"
          @click="$emit('update:modelValue', false)"
        />
      </v-card-title>
      <v-divider />
      <v-card-text style="max-height: 70vh">
        <v-progress-linear v-if="loading" indeterminate class="mb-3" />
        <v-alert
          v-else-if="!trace || !trace.steps.length"
          type="info"
          variant="tonal"
          density="compact"
        >
          {{ t("shipment.service.debug.no_trace") }}
        </v-alert>
        <v-timeline v-else side="end" density="compact" truncate-line="both">
          <v-timeline-item
            v-for="(step, i) in trace.steps"
            :key="i"
            :dot-color="categoryColor(step.category)"
            size="x-small"
          >
            <template #opposite>
              <span class="text-caption text-medium-emphasis font-mono">{{
                step.category
              }}</span>
            </template>
            <div class="text-body-2">{{ step.description }}</div>
            <div
              v-if="step.context && Object.keys(step.context).length"
              class="text-caption text-medium-emphasis font-mono mt-1"
            >
              {{ fmtContext(step.context) }}
            </div>
          </v-timeline-item>
        </v-timeline>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { RateDebugTrace } from "@shipment/services/service_selection.service";

const { t } = useI18n();

defineProps<{
  modelValue: boolean;
  serviceName: string;
  trace: RateDebugTrace | null;
  loading: boolean;
}>();

defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

/** A stable colour per trace category so the timeline reads at a glance. */
function categoryColor(category: string): string {
  const map: Record<string, string> = {
    config: "grey",
    zone: "blue",
    weight: "teal",
    price: "primary",
    supplement: "amber",
    supplements: "amber",
    extra_leg: "purple",
    fuel: "deep-orange",
    currency_to_eur: "green",
    currency_to_target: "green",
    warning: "warning",
    fallback: "error",
  };
  return map[category] ?? "grey";
}

/** Compact one-line render of a step's context map. */
function fmtContext(ctx: Record<string, unknown>): string {
  return Object.entries(ctx)
    .map(
      ([k, v]) =>
        `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
    )
    .join("  ·  ");
}
</script>
