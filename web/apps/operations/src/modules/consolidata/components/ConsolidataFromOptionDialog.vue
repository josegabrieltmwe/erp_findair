<template>
  <v-dialog
    :model-value="modelValue"
    max-width="520"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>{{ t("consolidata.fromOption.title") }}</v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">
          {{ t("consolidata.fromOption.help", { option: optionLabel }) }}
        </p>
        <ConsolidataApiError :error="error" />
        <ConsolidataClientPicker
          v-model="customerId"
          :label="t('filters.group.client')"
          :error-messages="error?.fields.customer_id"
          class="mb-2"
        />
        <v-text-field
          v-model="titolo"
          :label="t('consolidata.create.titolo')"
          maxlength="255"
          :error-messages="error?.fields.titolo"
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
          :disabled="!customerId || !titolo.trim()"
          @click="
            customerId && emit('submit', { customerId, titolo: titolo.trim() })
          "
        >
          {{ t("consolidata.create.submit") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import ConsolidataClientPicker from "./ConsolidataClientPicker.vue";
import type { ConsolidataError } from "../types";

const props = defineProps<{
  modelValue: boolean;
  saving: boolean;
  error: ConsolidataError | null;
  optionLabel: string;
  defaultTitle: string;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", v: { customerId: number; titolo: string }): void;
}>();
const { t } = useI18n();
const customerId = ref<number | null>(null);
const titolo = ref("");

watch(
  () => props.modelValue,
  (open) => {
    if (open) titolo.value = props.defaultTitle;
  },
);
</script>
