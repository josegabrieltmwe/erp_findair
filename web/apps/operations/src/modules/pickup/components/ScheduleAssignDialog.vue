<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { pickupAddress } from "../logic";
import { pickupsService } from "../services/pickups.service";
import type { Driver, Pickup } from "../types";

/**
 * Asigna autista+hora a UNA presa en una sola acción (tablero de franjas,
 * U-14) — equivalente al clic en la celda del grid de `gest_oper_list.php`
 * del legado, que fijaba ambos a la vez.
 */
const props = defineProps<{
  modelValue: boolean;
  pickup: Pickup | null;
  drivers: Driver[];
  /** Franja sugerida al abrir desde una celda vacía del tablero. */
  defaultSlot?: string | null;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  changed: [];
}>();

const { t } = useI18n();

/** Adónde se manda al autista (U-15). */
const address = computed(() =>
  props.pickup ? pickupAddress(props.pickup) : null,
);

const selectedDriver = ref<number | null>(null);
const time = ref("");
const busy = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.modelValue,
  (open) => {
    if (!open || !props.pickup) return;
    error.value = null;
    selectedDriver.value = props.pickup.id_contatti || null;
    time.value =
      props.defaultSlot || (props.pickup.data.split(" ")[1] ?? "").slice(0, 5);
  },
);

function close(): void {
  emit("update:modelValue", false);
}

async function confirm(): Promise<void> {
  if (!props.pickup || !selectedDriver.value || !time.value) return;
  busy.value = true;
  error.value = null;
  try {
    await pickupsService.assignDriver(
      props.pickup.id,
      selectedDriver.value,
      time.value,
    );
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
    max-width="380"
    @update:model-value="close"
  >
    <v-card v-if="pickup">
      <v-card-title>{{
        t("pickup.schedule.assign_title", { id: pickup.id })
      }}</v-card-title>
      <v-card-subtitle
        v-if="address"
        class="pk-assign-address"
        data-testid="assign-address"
      >
        <v-icon
          :icon="
            address.origin === 'expedicion'
              ? 'mdi-package-variant-closed'
              : 'mdi-office-building-outline'
          "
          size="14"
        />
        {{ address.full }}
        <div v-if="address.client" data-testid="assign-client">
          {{ t("pickup.schedule.client", { name: address.client }) }}
        </div>
        <div
          v-if="address.contact || address.email"
          data-testid="assign-contact"
        >
          <v-icon icon="mdi-phone-outline" size="14" />
          {{ [address.contact, address.email].filter(Boolean).join(" · ") }}
        </div>
        <div v-if="address.warning" class="text-warning">
          {{
            address.distinct > 0
              ? t("pickup.schedule.distinct_addresses", { n: address.distinct })
              : t("pickup.schedule.origin.sede_sin_expedicion")
          }}
        </div>
      </v-card-subtitle>
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
          v-model="selectedDriver"
          :items="drivers"
          item-title="nome"
          item-value="id"
          :label="t('pickup.assign.driver')"
          density="comfortable"
          variant="outlined"
          class="mb-2"
        />
        <v-text-field
          v-model="time"
          type="time"
          :label="t('pickup.schedule.time')"
          density="comfortable"
          variant="outlined"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{
          t("pickup.edit.cancel")
        }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="busy"
          :disabled="!selectedDriver || !time"
          @click="confirm"
        >
          {{ t("pickup.assign.assign") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.pk-assign-address {
  white-space: normal;
}
</style>
