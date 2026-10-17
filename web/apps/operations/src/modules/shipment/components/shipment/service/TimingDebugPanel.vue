<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center text-subtitle-1">
        <v-icon icon="mdi-timer-outline" class="me-2" size="20" />
        {{ t("shipment.timing.title") }}
        <v-spacer />
        <v-chip v-if="timing && timing.count" size="x-small" variant="tonal">
          {{ t("shipment.timing.runs", { count: timing.count }) }}
        </v-chip>
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
          v-else-if="!timing || !timing.phases.length"
          type="info"
          variant="tonal"
          density="compact"
        >
          {{ t("shipment.timing.no_data") }}
        </v-alert>
        <template v-else>
          <div
            v-if="timing.captured_at"
            class="text-caption text-medium-emphasis mb-3"
          >
            {{ t("shipment.timing.captured_at") }}:
            {{ fmtDate(timing.captured_at) }}
          </div>
          <v-table density="compact" class="timing-table">
            <thead>
              <tr>
                <th>{{ t("shipment.timing.cols.phase") }}</th>
                <th class="text-right">
                  {{ t("shipment.timing.cols.total") }}
                </th>
                <th class="text-right">
                  {{ t("shipment.timing.cols.fanout") }}
                </th>
                <th class="text-right">
                  {{ t("shipment.timing.cols.couriers") }}
                </th>
                <th class="text-right">
                  {{ t("shipment.timing.cols.services") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, i) in timing.phases" :key="i">
                <td>
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    :color="phaseColor(p.phase)"
                  >
                    {{ phaseLabel(p.phase) }}
                  </v-chip>
                </td>
                <td class="text-right font-mono">{{ fmtMs(p.total_ms) }}</td>
                <td class="text-right font-mono">
                  <span :class="{ 'text-warning': isSlowFanout(p) }">
                    {{
                      p.courier_fanout_ms != null
                        ? fmtMs(p.courier_fanout_ms)
                        : "—"
                    }}
                  </span>
                </td>
                <td class="text-right text-medium-emphasis">
                  <template v-if="p.couriers_queried != null">
                    {{ p.couriers_responded ?? 0 }}/{{ p.couriers_queried }}
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="text-right text-medium-emphasis">
                  {{ p.services_count ?? "—" }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type {
  ShipmentTiming,
  TimingPhase,
} from "@shipment/services/timing.service";

const { t, locale } = useI18n();

defineProps<{
  modelValue: boolean;
  timing: ShipmentTiming | null;
  loading: boolean;
}>();

defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

function phaseLabel(phase: string): string {
  // Known phases get a translated label; unknown ones show the raw token.
  const key = `shipment.timing.phases.${phase}`;
  const tr = t(key);
  return tr === key ? phase : tr;
}

function phaseColor(phase: string): string {
  return phase === "fornitore"
    ? "primary"
    : phase === "client"
      ? "teal"
      : "grey";
}

function fmtMs(v: number): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(2)} s`;
  return `${Math.round(v)} ms`;
}

/** Flag a fan-out that dominates the total (≥1.5s and ≥70% of total). */
function isSlowFanout(p: TimingPhase): boolean {
  const f = p.courier_fanout_ms ?? 0;
  return f >= 1500 && p.total_ms > 0 && f / p.total_ms >= 0.7;
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
</script>

<style scoped>
.timing-table :deep(thead th) {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-feature-settings: "tnum";
}
</style>
