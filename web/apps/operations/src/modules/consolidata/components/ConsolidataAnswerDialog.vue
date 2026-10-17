<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ t("consolidata.answer.title") }}</v-card-title>
      <v-card-text>
        <ConsolidataApiError :error="error" />
        <v-text-field
          v-model.number="form.prezzo"
          :label="t('consolidata.answer.price', { cur: currency })"
          type="number"
          min="0"
          step="0.01"
          :error-messages="error?.fields.prezzo"
        />
        <v-text-field
          v-model="form.valida_fino"
          :label="t('consolidata.answer.validUntil')"
          :hint="t('consolidata.answer.validUntilHint')"
          persistent-hint
          type="date"
          :error-messages="error?.fields.valida_fino"
        />
        <v-textarea
          v-model="form.nota"
          :label="t('consolidata.answer.note')"
          rows="3"
          :error-messages="error?.fields.nota"
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
          :disabled="!form.prezzo"
          @click="submit"
        >
          {{ t("consolidata.answer.send") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import type { AnswerPayload, ConsolidataError } from "../types";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error: ConsolidataError | null;
  currency: string;
  initialPrice?: number | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", payload: AnswerPayload): void;
}>();
const { t } = useI18n();

const form = reactive<{
  prezzo: number | null;
  valida_fino: string;
  nota: string;
}>({
  prezzo: null,
  valida_fino: "",
  nota: "",
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.prezzo = props.initialPrice ?? null;
      form.valida_fino = "";
      form.nota = "";
    }
  },
);

function submit(): void {
  const payload: AnswerPayload = { prezzo: Number(form.prezzo) };
  if (form.valida_fino) payload.valida_fino = form.valida_fino;
  if (form.nota.trim()) payload.nota = form.nota.trim();
  emit("submit", payload);
}
</script>
