<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ t("consolidata.legs.editTitle") }}</v-card-title>
      <v-card-text>
        <ConsolidataApiError :error="error" />
        <v-text-field
          v-model.number="form.weight"
          :label="t('consolidata.legs.weight')"
          type="number"
          step="0.01"
          :error-messages="err('leg.weight')"
        />
        <v-text-field
          v-model="form.goods"
          :label="t('consolidata.legs.goods')"
          :error-messages="err('leg.goods')"
        />
        <v-text-field
          v-model.number="form.value"
          :label="t('consolidata.legs.value')"
          type="number"
          step="0.01"
          :error-messages="err('leg.value')"
        />
        <v-textarea
          v-model="form.note"
          :label="t('consolidata.legs.note')"
          rows="2"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">{{
          t("consolidata.common.cancel")
        }}</v-btn>
        <v-btn color="primary" :loading="saving" @click="submit">{{
          t("consolidata.common.save")
        }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import type { ConsolidataError, Leg } from "../types";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error: ConsolidataError | null;
  leg: Leg | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", leg: Record<string, unknown>): void;
}>();
const { t } = useI18n();
const form = reactive<{
  weight: number | null;
  goods: string;
  value: number | null;
  note: string;
}>({
  weight: null,
  goods: "",
  value: null,
  note: "",
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
        weight: props.leg.peso,
        goods: props.leg.merce ?? "",
        value: props.leg.valore,
        note: props.leg.note ?? "",
      });
    }
  },
);

function submit(): void {
  emit("submit", {
    weight: form.weight,
    goods: form.goods,
    value: form.value,
    note: form.note,
  });
}
</script>
