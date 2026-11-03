<template>
  <v-dialog
    :model-value="modelValue"
    max-width="440"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ title || t("consolidata.assign.title") }}</v-card-title>
      <v-card-text>
        <ConsolidataApiError v-if="error" :error="error" />
        <ConsolidataUserPicker
          v-model="userId"
          :label="t('consolidata.assign.user')"
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
          :disabled="!userId"
          @click="userId && emit('submit', userId)"
        >
          {{ t("consolidata.assign.submit") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import { useDialogErrorScope } from "../composables/useDialogErrorScope";
import ConsolidataUserPicker from "./ConsolidataUserPicker.vue";
import type { ConsolidataError } from "../types";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error?: ConsolidataError | null;
  title?: string;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", userId: number): void;
}>();
const { t } = useI18n();
useDialogErrorScope(() => props.modelValue);
const userId = ref<number | null>(null);

watch(
  () => props.modelValue,
  (open) => {
    if (open) userId.value = null;
  },
);
</script>
