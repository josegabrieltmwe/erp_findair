<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { pickupsService } from "../services/pickups.service";
import type { Pickup, PickupWritePayload } from "../types";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  pickup: Pickup | null;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  saved: [];
}>();

const isEdit = computed(() => props.pickup !== null);
const busy = ref(false);
const error = ref<string | null>(null);

const form = ref<PickupWritePayload>({});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    error.value = null;
    if (props.pickup) {
      form.value = {
        id_sede: props.pickup.id_sede,
        id_contatti: props.pickup.id_contatti,
        data: props.pickup.data,
        address_sped: props.pickup.address_sped,
        presa_fissa: props.pickup.presa_fissa,
        affidata: props.pickup.affidata,
        n_colli: props.pickup.n_colli,
        peso: props.pickup.peso,
        note: props.pickup.note,
      };
    } else {
      form.value = {
        id_sede: undefined,
        id_contatti: 0,
        data: new Date().toISOString().slice(0, 16).replace("T", " "),
        address_sped: "N",
        presa_fissa: "N",
        affidata: "N",
      };
    }
  },
);

function close(): void {
  emit("update:modelValue", false);
}

async function save(): Promise<void> {
  busy.value = true;
  error.value = null;
  try {
    if (isEdit.value && props.pickup) {
      await pickupsService.update(props.pickup.id, form.value);
    } else {
      await pickupsService.create(form.value);
    }
    emit("saved");
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
    max-width="560"
    @update:model-value="close"
  >
    <v-card>
      <v-card-title>{{
        isEdit ? t("pickup.edit.edit_title") : t("pickup.edit.new_title")
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

        <v-text-field
          v-model.number="form.id_sede"
          :label="t('pickup.edit.sede')"
          type="number"
          density="comfortable"
          variant="outlined"
          class="mb-3"
        />
        <v-text-field
          v-model.number="form.id_contatti"
          :label="t('pickup.edit.autista')"
          :hint="t('pickup.edit.autista_hint')"
          type="number"
          density="comfortable"
          variant="outlined"
          class="mb-3"
        />
        <v-text-field
          v-model="form.data"
          :label="t('pickup.edit.datetime')"
          :hint="t('pickup.edit.datetime_hint')"
          persistent-hint
          density="comfortable"
          variant="outlined"
          class="mb-3"
        />
        <v-select
          v-model="form.address_sped"
          :items="[
            { title: t('pickup.edit.at_sede'), value: 'N' },
            { title: t('pickup.edit.triangulation'), value: 'S' },
          ]"
          :label="t('pickup.edit.address')"
          density="comfortable"
          variant="outlined"
          class="mb-3"
        />
        <div class="d-flex ga-3 mb-3">
          <v-text-field
            v-model.number="form.n_colli"
            :label="t('pickup.edit.colli')"
            type="number"
            density="comfortable"
            variant="outlined"
            hide-details
          />
          <v-text-field
            v-model.number="form.peso"
            :label="t('pickup.edit.peso')"
            type="number"
            density="comfortable"
            variant="outlined"
            hide-details
          />
        </div>
        <v-switch
          v-model="form.presa_fissa"
          :label="t('pickup.edit.fixed')"
          true-value="S"
          false-value="N"
          color="info"
          density="compact"
          hide-details
          class="mb-2"
        />
        <v-textarea
          v-model="form.note"
          :label="t('pickup.edit.note')"
          rows="2"
          density="comfortable"
          variant="outlined"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{
          t("pickup.edit.cancel")
        }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="busy" @click="save">
          {{ t("pickup.edit.save") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
