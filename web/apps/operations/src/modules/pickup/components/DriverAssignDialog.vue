<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useConfirmStore } from "@shared/anagrafiche/stores/confirm.store";
import { failedItems } from "../logic";
import { pickupsService } from "../services/pickups.service";
import type { BulkResult, Driver, Pickup } from "../types";

const { t } = useI18n();
const confirm = useConfirmStore();

/**
 * Asigna o libera el autista de UNA presa (`pickup`) o de VARIAS (`pickupIds`,
 * asignación masiva desde la lista). En modo masivo se muestra el resultado por
 * presa y el diálogo no se cierra hasta que se pulsa «Cerrar».
 */
const props = defineProps<{
  modelValue: boolean;
  pickup: Pickup | null;
  pickupIds?: number[];
  date: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  changed: [];
}>();

const drivers = ref<Driver[]>([]);
const selected = ref<number | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
const result = ref<BulkResult | null>(null);

// Copia al abrir: la lista puede vaciar su selección mientras se muestra el resultado.
const ids = ref<number[]>([]);
const bulk = computed(() => ids.value.length > 0);
const failed = computed(() => (result.value ? failedItems(result.value) : []));

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    ids.value = [...(props.pickupIds ?? [])];
    if (!props.pickup && !bulk.value) return;
    error.value = null;
    result.value = null;
    selected.value = props.pickup?.id_contatti || null;
    try {
      drivers.value = await pickupsService.availableDrivers(props.date);
    } catch (e) {
      error.value = e instanceof Error ? e.message : t("errors.load");
    }
  },
);

function close(): void {
  emit("update:modelValue", false);
}

async function run(
  action: () => Promise<unknown>,
  bulkAction: () => Promise<BulkResult>,
): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    if (bulk.value) {
      result.value = await bulkAction();
      emit("changed");
      return;
    }
    await action();
    emit("changed");
    close();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action");
  } finally {
    busy.value = false;
  }
}

async function assign(): Promise<void> {
  if (!selected.value) return;
  const driver = selected.value;
  await run(
    () => pickupsService.assignDriver(props.pickup!.id, driver),
    () => pickupsService.assignMany(ids.value, driver),
  );
}

async function unassign(): Promise<void> {
  if (bulk.value) {
    const ok = await confirm.ask({
      title: t("pickup.assign.bulk_unassign_title"),
      message: t("pickup.assign.bulk_unassign_msg", { n: ids.value.length }),
      variant: "danger",
    });
    if (!ok) return;
  }
  await run(
    () => pickupsService.unassignDriver(props.pickup!.id),
    () => pickupsService.unassignMany(ids.value),
  );
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="440"
    @update:model-value="close"
  >
    <v-card v-if="pickup || bulk">
      <v-card-title>{{
        bulk
          ? t("pickup.assign.bulk_title", { n: ids.length })
          : t("pickup.assign.title", { id: pickup?.id })
      }}</v-card-title>
      <v-card-text>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ error }}
        </v-alert>
        <template v-if="result">
          <v-alert
            :type="result.failed ? 'warning' : 'success'"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            {{
              t("pickup.assign.bulk_summary", {
                ok: result.assigned,
                failed: result.failed,
              })
            }}
          </v-alert>
          <ul v-if="failed.length" class="pk-bulk-errors">
            <li v-for="f in failed" :key="f.pickup_id">
              #{{ f.pickup_id }} — {{ f.error || t("pickup.assign.bulk_failed") }}
            </li>
          </ul>
        </template>
        <v-select
          v-else
          v-model="selected"
          :items="drivers"
          item-title="nome"
          item-value="id"
          :label="t('pickup.assign.driver')"
          density="comfortable"
          variant="outlined"
        />
      </v-card-text>
      <v-card-actions>
        <v-btn
          v-if="!result && (bulk || pickup?.id_contatti)"
          variant="text"
          color="error"
          :loading="busy"
          @click="unassign"
        >
          {{ t("pickup.assign.unassign") }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">{{
          result ? t("pickup.assign.close") : t("pickup.edit.cancel")
        }}</v-btn>
        <v-btn
          v-if="!result"
          color="primary"
          variant="flat"
          :loading="busy"
          :disabled="!selected"
          @click="assign"
        >
          {{ t("pickup.assign.assign") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.pk-bulk-errors {
  margin: 0;
  padding-left: 18px;
  max-height: 220px;
  overflow-y: auto;
  font-size: 0.85rem;
}
</style>
