<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { pickupsService } from "../services/pickups.service";
import type { Driver, Pickup } from "../types";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  pickup: Pickup | null;
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

watch(
  () => props.modelValue,
  async (open) => {
    if (!open || !props.pickup) return;
    error.value = null;
    selected.value = props.pickup.id_contatti || null;
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

async function assign(): Promise<void> {
  if (!props.pickup || !selected.value) return;
  busy.value = true;
  error.value = null;
  try {
    await pickupsService.assignDriver(props.pickup.id, selected.value);
    emit("changed");
    close();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action");
  } finally {
    busy.value = false;
  }
}

async function unassign(): Promise<void> {
  if (!props.pickup) return;
  busy.value = true;
  error.value = null;
  try {
    await pickupsService.unassignDriver(props.pickup.id);
    emit("changed");
    close();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="440"
    @update:model-value="close"
  >
    <v-card v-if="pickup">
      <v-card-title>{{
        t("pickup.assign.title", { id: pickup.id })
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
        <v-select
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
          v-if="pickup.id_contatti"
          variant="text"
          color="error"
          :loading="busy"
          @click="unassign"
        >
          {{ t("pickup.assign.unassign") }}
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">{{
          t("pickup.edit.cancel")
        }}</v-btn>
        <v-btn
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
