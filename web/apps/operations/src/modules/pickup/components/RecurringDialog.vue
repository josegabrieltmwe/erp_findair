<script setup lang="ts">
import { todayLocal } from "@shared/utils/date";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { pickupsService } from "../services/pickups.service";
import type { GenerateDailyResult, RecurringConfig } from "../types";

const { t } = useI18n();
const confirm = useConfirmStore();

/**
 * Ritiro fijo (presa fissa): activar o desactivar el giro fijo de una sede y
 * generar las presas del día (con simulación). Usa `recurringConfig`,
 * `toggleRecurring` y `generateDaily` de `pickups.service.ts`.
 */
const props = defineProps<{ modelValue: boolean; sedeId?: number | null }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; changed: [] }>();

const sede = ref<number | null>(null);
const config = ref<RecurringConfig | null>(null);
const date = ref(todayLocal());
const dryRun = ref(true);
const includeNonBusiness = ref(false);
const result = ref<GenerateDailyResult | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    sede.value = props.sedeId ?? null;
    config.value = null;
    result.value = null;
    error.value = null;
    date.value = todayLocal();
    dryRun.value = true;
    includeNonBusiness.value = false;
    if (sede.value) void loadConfig();
  },
);

function close(): void {
  emit("update:modelValue", false);
}

async function guarded(fn: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    await fn();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action");
  } finally {
    busy.value = false;
  }
}

async function loadConfig(): Promise<void> {
  if (!sede.value) return;
  const id = sede.value;
  await guarded(async () => {
    config.value = await pickupsService.recurringConfig(id);
  });
}

const isFixed = computed(() => config.value?.presa_fissa === "S");

async function toggle(): Promise<void> {
  if (!sede.value || !config.value) return;
  const enable = !isFixed.value;
  const ok = await confirm.ask({
    title: t(enable ? "pickup.recurring.enable_title" : "pickup.recurring.disable_title"),
    message: t(enable ? "pickup.recurring.enable_msg" : "pickup.recurring.disable_msg", {
      id: sede.value,
    }),
  });
  if (!ok) return;
  const id = sede.value;
  await guarded(async () => {
    config.value = await pickupsService.toggleRecurring(id, enable);
    emit("changed");
  });
}

async function generate(): Promise<void> {
  if (!dryRun.value) {
    const ok = await confirm.ask({
      title: t("pickup.recurring.generate_title"),
      message: t("pickup.recurring.generate_msg", { date: date.value }),
      variant: "danger",
    });
    if (!ok) return;
  }
  await guarded(async () => {
    result.value = await pickupsService.generateDaily(date.value, {
      dry_run: dryRun.value,
      include_non_business_days: includeNonBusiness.value,
    });
    if (!result.value.dry_run && !dryRun.value) emit("changed");
  });
}

/** Contadores del resultado, en el orden en que se muestran. */
const counters = computed(() => {
  const r = result.value;
  if (!r) return [];
  return [
    { key: "generated", value: r.generated },
    { key: "skipped", value: r.skipped },
    { key: "invalid", value: r.invalid },
    { key: "skipped_courier", value: r.skipped_courier },
    { key: "skipped_rest_day", value: r.skipped_rest_day },
    { key: "skipped_weekday", value: r.skipped_weekday },
    { key: "calendar_errors", value: r.calendar_errors },
  ].filter((c) => c.value !== undefined);
});
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="560" @update:model-value="close">
    <v-card>
      <v-card-title>{{ t("pickup.recurring.title") }}</v-card-title>
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
          {{ error }}
        </v-alert>

        <h3 class="pk-sub">{{ t("pickup.recurring.sede_section") }}</h3>
        <div class="d-flex ga-3 align-center mb-2">
          <v-text-field
            v-model.number="sede"
            :label="t('pickup.recurring.sede')"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 160px"
          />
          <v-btn variant="tonal" :disabled="!sede" :loading="busy" @click="loadConfig">
            {{ t("pickup.recurring.check") }}
          </v-btn>
        </div>
        <div v-if="config" class="d-flex ga-3 align-center flex-wrap mb-4">
          <v-chip size="small" :color="isFixed ? 'info' : 'default'">
            {{ isFixed ? t("pickup.recurring.is_fixed") : t("pickup.recurring.not_fixed") }}
          </v-chip>
          <span v-if="config.presa_ora" class="text-body-2">
            {{ t("pickup.recurring.time") }}: {{ config.presa_ora }}
          </span>
          <v-spacer />
          <v-btn
            size="small"
            variant="tonal"
            :color="isFixed ? 'warning' : 'primary'"
            :loading="busy"
            @click="toggle"
          >
            {{ isFixed ? t("pickup.recurring.disable") : t("pickup.recurring.enable") }}
          </v-btn>
        </div>

        <v-divider class="my-4" />

        <h3 class="pk-sub">{{ t("pickup.recurring.generate_section") }}</h3>
        <v-text-field
          v-model="date"
          :label="t('pickup.recurring.date')"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          class="mb-2"
          style="max-width: 200px"
        />
        <v-switch
          v-model="dryRun"
          :label="t('pickup.recurring.dry_run')"
          density="compact"
          hide-details
          color="primary"
        />
        <v-switch
          v-model="includeNonBusiness"
          :label="t('pickup.recurring.include_non_business')"
          density="compact"
          hide-details
          color="primary"
        />

        <template v-if="result">
          <v-alert
            :type="result.locked ? 'warning' : 'success'"
            variant="tonal"
            density="compact"
            class="mt-3 mb-2"
          >
            {{
              result.locked
                ? t("pickup.recurring.locked")
                : result.dry_run
                  ? t("pickup.recurring.result_dry", { date: result.date })
                  : t("pickup.recurring.result_live", { date: result.date })
            }}
          </v-alert>
          <ul class="pk-counters">
            <li v-for="c in counters" :key="c.key">
              <span>{{ t(`pickup.recurring.counter.${c.key}`) }}</span>
              <b>{{ c.value }}</b>
            </li>
          </ul>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t("pickup.assign.close") }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="busy"
          :disabled="!date"
          @click="generate"
        >
          {{ dryRun ? t("pickup.recurring.simulate") : t("pickup.recurring.generate") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.pk-sub {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-bottom: 8px;
}
.pk-counters {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.pk-counters li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.9rem;
}
</style>
