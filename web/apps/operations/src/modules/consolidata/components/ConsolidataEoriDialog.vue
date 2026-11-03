<template>
  <v-dialog
    :model-value="modelValue"
    max-width="440"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ t("consolidata.eori.title") }}</v-card-title>
      <v-card-text>
        <ConsolidataApiError :error="error" />
        <v-text-field
          v-model="value"
          :label="t('consolidata.eori.label')"
          :hint="t('consolidata.eori.hint')"
          persistent-hint
          maxlength="17"
          :error-messages="error?.fields.eori_dichiarante"
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
          @click="emit('submit', value)"
          >{{ t("consolidata.common.save") }}</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import { useDialogErrorScope } from "../composables/useDialogErrorScope";
import type { ConsolidataError } from "../types";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error: ConsolidataError | null;
  current: string | null;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", eori: string): void;
}>();
const { t } = useI18n();
useDialogErrorScope(() => props.modelValue);
const value = ref("");

watch(
  () => props.modelValue,
  (open) => {
    if (open) value.value = props.current ?? "";
  },
);
</script>
