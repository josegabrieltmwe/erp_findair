<script setup lang="ts">
import { todayLocal } from "@shared/utils/date";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { pickupsService } from "../services/pickups.service";
import type {
  GenerateDailyResult,
  PickupException,
  RecurringConfig,
} from "../types";

const { t } = useI18n();
const confirm = useConfirmStore();

/**
 * Ritiro fijo (presa fissa): activar o desactivar el giro fijo de una sede,
 * gestionar sus excepciones puntuales y vacaciones (G19, T-42), y generar las
 * presas del día (con simulación). Usa `recurringConfig`, `toggleRecurring`,
 * `listExceptions`/`createException`/`deleteException` y `generateDaily` de
 * `pickups.service.ts`.
 */
const props = defineProps<{ modelValue: boolean; sedeId?: number | null }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; changed: [] }>();

const sede = ref<number | null>(null);
const config = ref<RecurringConfig | null>(null);
const exceptions = ref<PickupException[]>([]);
const newExceptionFrom = ref("");
const newExceptionTo = ref("");
const newExceptionReason = ref("");
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
    exceptions.value = [];
    newExceptionFrom.value = "";
    newExceptionTo.value = "";
    newExceptionReason.value = "";
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
    exceptions.value = await pickupsService.listExceptions(id);
  });
}

const isFixed = computed(() => config.value?.presa_fissa === "S");

async function addException(): Promise<void> {
  if (!sede.value || !newExceptionFrom.value) return;
  const id = sede.value;
  await guarded(async () => {
    await pickupsService.createException({
      id_sede: id,
      fecha_desde: newExceptionFrom.value,
      fecha_hasta: newExceptionTo.value || undefined,
      motivo: newExceptionReason.value || undefined,
    });
    newExceptionFrom.value = "";
    newExceptionTo.value = "";
    newExceptionReason.value = "";
    exceptions.value = await pickupsService.listExceptions(id);
  });
}

async function removeException(exception: PickupException): Promise<void> {
  const ok = await confirm.ask({
    title: t("pickup.recurring.delete_exception_title"),
    message: t("pickup.recurring.delete_exception_msg", {
      from: exception.fecha_desde,
      to: exception.fecha_hasta,
    }),
    variant: "danger",
  });
  if (!ok) return;
  const id = sede.value;
  if (!id) return;
  await guarded(async () => {
    await pickupsService.deleteException(exception.id);
    exceptions.value = await pickupsService.listExceptions(id);
  });
}

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
    { key: "skipped_exception", value: r.skipped_exception },
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

        <template v-if="sede">
          <v-divider class="my-4" />

          <h3 class="pk-sub">{{ t("pickup.recurring.exceptions_section") }}</h3>
          <ul v-if="exceptions.length" class="pk-exceptions mb-3">
            <li v-for="ex in exceptions" :key="ex.id">
              <span class="pk-exceptions__dates">
                {{ ex.fecha_desde }}<template v-if="ex.fecha_hasta !== ex.fecha_desde"> — {{ ex.fecha_hasta }}</template>
              </span>
              <span v-if="ex.motivo" class="pk-exceptions__reason">{{ ex.motivo }}</span>
              <v-btn
                size="x-small"
                variant="text"
                icon="mdi-close"
                :title="t('pickup.recurring.delete_exception_title')"
                :disabled="busy"
                @click="removeException(ex)"
              />
            </li>
          </ul>
          <p v-else class="text-body-2 text-medium-emphasis mb-3">
            {{ t("pickup.recurring.no_exceptions") }}
          </p>

          <div class="d-flex ga-2 align-end flex-wrap mb-4">
            <v-text-field
              v-model="newExceptionFrom"
              :label="t('pickup.recurring.exception_from')"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 170px"
            />
            <v-text-field
              v-model="newExceptionTo"
              :label="t('pickup.recurring.exception_to')"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 170px"
            />
            <v-text-field
              v-model="newExceptionReason"
              :label="t('pickup.recurring.exception_reason')"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 220px"
            />
            <v-btn
              variant="tonal"
              :disabled="!newExceptionFrom"
              :loading="busy"
              @click="addException"
            >
              {{ t("pickup.recurring.add_exception") }}
            </v-btn>
          </div>
        </template>

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
.pk-exceptions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.pk-exceptions li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}
.pk-exceptions__dates {
  font-weight: 500;
}
.pk-exceptions__reason {
  color: rgba(var(--v-theme-on-surface), 0.6);
  flex: 1;
}
</style>
