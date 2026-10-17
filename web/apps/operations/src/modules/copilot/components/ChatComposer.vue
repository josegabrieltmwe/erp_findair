<template>
  <div class="composer">
    <v-textarea
      v-model="draft"
      :placeholder="t('copilot.chat.placeholder')"
      rows="1"
      auto-grow
      max-rows="6"
      hide-details
      density="comfortable"
      :disabled="disabled"
      @keydown.enter.exact.prevent="submit"
    />
    <v-btn
      v-if="voiceSupported"
      :icon="listening ? 'mdi-microphone' : 'mdi-microphone-outline'"
      :color="listening ? 'error' : 'secondary'"
      size="large"
      variant="tonal"
      :disabled="disabled"
      :aria-label="'voice'"
      @click="emit('mic')"
    />
    <v-btn
      icon="mdi-send"
      color="primary"
      size="large"
      :disabled="disabled || draft.trim() === ''"
      :aria-label="t('copilot.chat.send')"
      @click="submit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  disabled?: boolean;
  voiceSupported?: boolean;
  listening?: boolean;
}>();
const emit = defineEmits<{
  (e: "send", value: string): void;
  (e: "mic"): void;
}>();
const { t } = useI18n();

const draft = ref("");

function submit(): void {
  const text = draft.value.trim();
  if (text === "" || props.disabled) return;
  emit("send", text);
  draft.value = "";
}
</script>

<style scoped>
.composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgb(var(--v-theme-on-surface-variant) / 0.15);
  background: rgb(var(--v-theme-surface));
}
.composer :deep(.v-textarea) {
  flex: 1 1 auto;
}
</style>
