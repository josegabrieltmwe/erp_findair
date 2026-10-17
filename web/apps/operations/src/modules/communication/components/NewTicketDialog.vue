<template>
  <AppDialog
    :open="modelValue"
    :title="t('communication.new_ticket.title')"
    icon="mdi-ticket-outline"
    size="sm"
    :persistent="saving"
    :close-disabled="saving"
    @close="cancel"
  >
    <v-text-field
      v-model="subject"
      :label="t('communication.new_ticket.subject')"
      density="compact"
      variant="outlined"
      maxlength="80"
      counter
      autofocus
    />
    <v-textarea
      v-model="body"
      :label="t('communication.new_ticket.body')"
      density="compact"
      variant="outlined"
      rows="4"
      auto-grow
      maxlength="4000"
    />
    <div v-if="error" class="text-error text-caption mt-1">{{ error }}</div>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" :disabled="saving" @click="cancel">
        {{ t("common.cancel") }}
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="saving"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ t("communication.new_ticket.submit") }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";

import { useCommunicationStore } from "../stores/communication.store";
import type { Conversation } from "../types";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  created: [Conversation];
}>();

const store = useCommunicationStore();
const { t } = useI18n();

const subject = ref("");
const body = ref("");
const saving = ref(false);
const error = ref("");

const canSubmit = computed(
  () => subject.value.trim() !== "" && body.value.trim() !== "" && !saving.value,
);

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      subject.value = "";
      body.value = "";
      error.value = "";
    }
  },
);

function cancel(): void {
  emit("update:modelValue", false);
}

async function submit(): Promise<void> {
  error.value = "";
  saving.value = true;
  try {
    const conversation = await store.openTicket({
      subject: subject.value.trim(),
      body: body.value.trim(),
    });
    emit("update:modelValue", false);
    emit("created", conversation);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("communication.new_ticket.error");
  } finally {
    saving.value = false;
  }
}
</script>
