<template>
  <div class="bubble-row" :class="bubble.role">
    <v-avatar
      v-if="bubble.role === 'assistant'"
      size="32"
      color="primary"
      class="bubble-avatar"
    >
      <v-icon icon="mdi-robot-happy-outline" size="18" color="on-primary" />
    </v-avatar>

    <div class="bubble" :class="[bubble.role, { error: bubble.error }]">
      <div v-if="bubble.pending" class="pending">
        <v-progress-circular
          indeterminate
          size="16"
          width="2"
          color="primary"
        />
        <span class="ml-2 text-medium-emphasis">{{
          t("copilot.chat.thinking")
        }}</span>
      </div>

      <template v-else>
        <div class="bubble-text" v-text="bubble.text" />

        <div v-if="bubble.toolsUsed?.length" class="tools">
          <v-icon icon="mdi-tools" size="12" class="mr-1" />
          {{ t("copilot.chat.tools_used", { tools: toolNames }) }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ChatBubble } from "../types";

const props = defineProps<{ bubble: ChatBubble }>();
const { t } = useI18n();

const toolNames = computed(() =>
  (props.bubble.toolsUsed ?? []).map((tool) => tool.name).join(", "),
);
</script>

<style scoped>
.bubble-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 14px;
}
.bubble-row.user {
  justify-content: flex-end;
}
.bubble-avatar {
  flex: 0 0 auto;
  margin-top: 2px;
}
.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble.user {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  border-bottom-right-radius: 4px;
}
.bubble.assistant {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgb(var(--v-theme-on-surface-variant) / 0.15);
  border-bottom-left-radius: 4px;
}
.bubble.error {
  background: rgb(var(--v-theme-error) / 0.1);
  border-color: rgb(var(--v-theme-error) / 0.4);
}
.pending {
  display: flex;
  align-items: center;
}
.tools {
  margin-top: 8px;
  font-size: 11px;
  opacity: 0.65;
}
</style>
