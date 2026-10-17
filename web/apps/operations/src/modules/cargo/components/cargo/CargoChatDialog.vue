<template>
  <AppDialog
    :open="open"
    :title="t('cargo.chat.dialog_title')"
    icon="mdi-message-text-outline"
    size="md"
    persistent
    @close="close"
  >
    <div style="max-height: 60vh; overflow-y: auto">
      <v-list lines="two" density="compact">
        <v-list-item v-for="m in messages" :key="m.id">
          <v-list-item-title class="font-weight-medium">
            {{ senderLabel(m) }}
          </v-list-item-title>
          <v-list-item-subtitle class="text-wrap">{{
            m.body
          }}</v-list-item-subtitle>
          <template #append>
            <span class="text-caption text-medium-emphasis">{{
              formatTs(m.sent_at)
            }}</span>
          </template>
        </v-list-item>
        <v-list-item v-if="!messages.length">
          <v-list-item-subtitle>{{
            t("cargo.chat.no_messages")
          }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </div>
    <template #actions>
      <v-textarea
        v-model="draft"
        :placeholder="t('cargo.chat.write_message')"
        rows="2"
        auto-grow
        hide-details
      />
      <v-btn
        class="ms-2"
        :loading="sending"
        color="primary"
        variant="flat"
        @click="send"
        >{{ t("common.send") }}</v-btn
      >
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, watch } from "vue";
import AppDialog from "@shared/ui/AppDialog.vue";
import { chatService, type ChatMessage } from "@cargo/services/chat.service";
import { useToastStore } from "@cargo/stores/toast.store";

const { t } = useI18n();
const props = defineProps<{ modelValue: boolean; cargoId: number | null }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const open = ref(props.modelValue);
watch(
  () => props.modelValue,
  (v) => (open.value = v),
);
watch(open, (v) => emit("update:modelValue", v));

const messages = ref<ChatMessage[]>([]);
const draft = ref("");
const sending = ref(false);
const toasts = useToastStore();

watch([open, () => props.cargoId], async ([isOpen, id]) => {
  if (!isOpen || !id) return;
  // The chat endpoint accepts shipment_id; cargo shares the table with express
  // because spedy_chat keys on a shipment id regardless of modality. Pass the
  // 'cargo' type so the backend resolves the right role/visibility.
  const r = await chatService.list(id, "cargo");
  if (r.success) messages.value = r.data.messages;
});

async function send(): Promise<void> {
  if (!props.cargoId || !draft.value.trim()) return;
  sending.value = true;
  try {
    const r = await chatService.send(
      props.cargoId,
      draft.value.trim(),
      "cargo",
    );
    if (!r.success) {
      toasts.push("error", t("cargo.chat.send_failed"));
      return;
    }
    messages.value.push(r.data.message);
    draft.value = "";
  } finally {
    sending.value = false;
  }
}

/** Best label for the message author from the sender DTO. */
function senderLabel(m: ChatMessage): string {
  return (
    m.sender.user_name ??
    m.sender.company_short_name ??
    `User ${m.sender.user_id}`
  );
}

/** Render the ISO 8601 sent_at as a locale date-time, falling back to raw. */
function formatTs(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function close(): void {
  open.value = false;
}
</script>
