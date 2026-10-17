<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ t("consolidata.legs.priceTitle") }}</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">{{ t("consolidata.legs.priceHelp") }}</p>
        <ConsolidataApiError :error="error" />
        <v-text-field
          v-model.number="form.prezzo"
          :label="t('consolidata.legs.price')"
          type="number"
          step="0.01"
          :error-messages="err('prezzo')"
        />
        <v-text-field
          v-model.number="form.fuel"
          :label="t('consolidata.legs.fuel')"
          type="number"
          step="0.01"
          :error-messages="err('fuel')"
        />
        <v-text-field
          v-model.number="form.supplementi"
          :label="t('consolidata.legs.surcharges')"
          type="number"
          step="0.01"
          :error-messages="err('supplementi')"
        />
        <v-text-field
          v-model="form.motivo"
          :label="t('consolidata.legs.reason')"
          :error-messages="err('motivo')"
        />
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
import { reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import type { ConsolidataError, Leg, PricePayload } from "../types";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error: ConsolidataError | null;
  leg: Leg | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", p: PricePayload): void;
}>();
const { t } = useI18n();
const form = reactive<PricePayload>({
  prezzo: 0,
  fuel: 0,
  supplementi: 0,
  motivo: "",
});

function err(field: string): string[] | undefined {
  const m = props.error?.fields[field];
  return m ? [m] : undefined;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.leg) {
      Object.assign(form, {
        prezzo: props.leg.prezzo,
        fuel: props.leg.fuel,
        supplementi: props.leg.supplementi,
        motivo: "",
      });
    }
  },
);
</script>
