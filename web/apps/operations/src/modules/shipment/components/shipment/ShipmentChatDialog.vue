<template>
  <AppDialog
    :open="open"
    :title="t('shipment.chat_dialog.title')"
    icon="mdi-chat-outline"
    size="md"
    persistent
    @close="close"
  >
    <div style="max-height: 60vh; overflow-y: auto">
      <v-list lines="two" density="compact">
        <v-list-item v-for="m in messages" :key="m.id">
          <v-list-item-title>{{ senderLabel(m) }}</v-list-item-title>
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
            t("shipment.chat_dialog.no_messages")
          }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </div>
    <template #actions>
      <v-textarea
        v-model="draft"
        :placeholder="t('shipment.chat_dialog.write_message')"
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
        >{{ t("shipment.chat_dialog.send") }}</v-btn
      >
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppDialog from "@shared/ui/AppDialog.vue";
import { chatService, type ChatMessage } from "@shipment/services/chat.service";
import { useToastStore } from "@shipment/stores/toast.store";

const { t } = useI18n();
const props = defineProps<{ modelValue: boolean; shipmentId: number | null }>();
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

watch([open, () => props.shipmentId], async ([isOpen, id]) => {
  if (!isOpen || !id) return;
  const r = await chatService.list(id);
  if (r.success) messages.value = r.data.messages;
});

async function send(): Promise<void> {
  if (!props.shipmentId || !draft.value.trim()) return;
  sending.value = true;
  try {
    const r = await chatService.send(props.shipmentId, draft.value.trim());
    if (!r.success) {
      toasts.push("error", t("shipment.chat_dialog.send_failed"));
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
    t("shipment.chat_dialog.user_n", { id: m.sender.user_id })
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
