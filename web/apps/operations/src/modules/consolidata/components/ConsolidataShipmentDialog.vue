<template>
  <v-dialog
    :model-value="modelValue"
    max-width="640"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{
        editing
          ? t("consolidata.shipments.edit")
          : t("consolidata.shipments.add")
      }}</v-card-title>
      <v-card-text>
        <ConsolidataApiError :error="error" />
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.ref"
              :label="t('consolidata.shipments.ref')"
              :disabled="editing"
              :error-messages="err('ref')"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model.number="form.id_spedizione"
              :label="t('consolidata.shipments.spedizioneId')"
              type="number"
              :error-messages="err('id_spedizione')"
            />
          </v-col>
          <v-col cols="4">
            <v-text-field
              v-model="form.orig_paese"
              :label="t('consolidata.shipments.country')"
              maxlength="2"
              :error-messages="err('orig_paese')"
            />
          </v-col>
          <v-col cols="8">
            <v-text-field
              v-model="form.orig_citta"
              :label="t('consolidata.shipments.city')"
              :error-messages="err('orig_citta')"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model="form.orig_cap"
              :label="t('consolidata.shipments.zip')"
              :error-messages="err('orig_cap')"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model="form.orig_terminal"
              :label="t('consolidata.shipments.terminal')"
              :error-messages="err('orig_terminal')"
            />
          </v-col>
          <v-col cols="6" sm="3">
            <v-text-field
              v-model.number="form.peso"
              :label="t('consolidata.shipments.weight')"
              type="number"
              step="0.01"
              :error-messages="err('peso')"
            />
          </v-col>
          <v-col cols="6" sm="3">
            <v-text-field
              v-model.number="form.colli"
              :label="t('consolidata.shipments.pieces')"
              type="number"
              :error-messages="err('colli')"
            />
          </v-col>
          <v-col cols="6" sm="3">
            <v-text-field
              v-model.number="form.volume_cm3"
              :label="t('consolidata.shipments.volume')"
              type="number"
              :error-messages="err('volume_cm3')"
            />
          </v-col>
          <v-col cols="6" sm="3">
            <v-text-field
              v-model.number="form.valore"
              :label="t('consolidata.shipments.value')"
              type="number"
              :error-messages="err('valore')"
            />
          </v-col>
          <v-col cols="12" sm="8">
            <v-text-field
              v-model="form.merce"
              :label="t('consolidata.shipments.goods')"
              :error-messages="err('merce')"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="form.data_pronta"
              :label="t('consolidata.shipments.readyDate')"
              type="date"
              :error-messages="err('data_pronta')"
            />
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{
          t("consolidata.common.cancel")
        }}</v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          @click="emit('submit', { ...form })"
          >{{ t("consolidata.common.save") }}</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import type { ConsolidataError, Shipment, ShipmentForm } from "../types";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error: ConsolidataError | null;
  shipment: Shipment | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", form: ShipmentForm): void;
}>();
const { t } = useI18n();

const blank = (): ShipmentForm => ({
  ref: "",
  orig_paese: "",
  orig_cap: "",
  orig_citta: "",
  orig_terminal: "",
  peso: null,
  colli: 1,
  volume_cm3: null,
  valore: null,
  merce: "",
  data_pronta: "",
  id_spedizione: null,
});
const form = reactive<ShipmentForm>(blank());
const editing = computed(() => props.shipment !== null);

function err(field: string): string[] | undefined {
  const m = props.error?.fields[`spedizione.${field}`];
  return m ? [m] : undefined;
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const s = props.shipment;
    Object.assign(
      form,
      s
        ? {
            ref: s.ref,
            orig_paese: s.orig_paese,
            orig_cap: s.orig_cap,
            orig_citta: s.orig_citta,
            orig_terminal: s.orig_terminal ?? "",
            peso: s.peso,
            colli: s.colli,
            volume_cm3: s.volume_cm3,
            valore: s.valore,
            merce: s.merce ?? "",
            data_pronta: s.data_pronta ?? "",
            id_spedizione: s.id_spedizione,
          }
        : blank(),
    );
  },
);
</script>
