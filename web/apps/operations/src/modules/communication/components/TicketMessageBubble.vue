<template>
  <div class="bubble-row" :class="message.from">
    <div class="bubble" :class="message.from">
      <div v-if="!message.sender.is_me" class="bubble-sender">
        {{ message.sender.name }}
      </div>
      <div class="bubble-text">{{ message.body }}</div>
      <div class="bubble-time">{{ fmtTime(message.sent_at) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommMessage } from "../types";

defineProps<{ message: CommMessage }>();

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<style scoped>
.bubble-row {
  display: flex;
  margin-bottom: 10px;
}
.bubble-row.mine {
  justify-content: flex-end;
}
.bubble {
  max-width: 78%;
  padding: 8px 12px;
  border-radius: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble.mine {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  border-bottom-right-radius: 4px;
}
.bubble.others {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgb(var(--v-theme-on-surface-variant) / 0.15);
  border-bottom-left-radius: 4px;
}
.bubble-sender {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.75;
  margin-bottom: 2px;
}
.bubble-time {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 4px;
  text-align: right;
}
</style>
