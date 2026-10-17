<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import { useCommunicationStore } from "../stores/communication.store";
import { useCommStream } from "../composables/useCommStream";
import TicketMessageBubble from "../components/TicketMessageBubble.vue";

const props = defineProps<{ id: string }>();

const store = useCommunicationStore();
const router = useRouter();
const { t } = useI18n();

const conversationId = computed(() => `ticket:${props.id}`);
// Fallback legible cuando se entra directo por URL y la lista no trae el resumen completo
// (fetchThread() ya intenta precargar la lista; esto cubre el resto, p.ej. ticket fuera de la
// primera página): nunca mostrar el id interno "ticket:<n>" tal cual.
const displayTitle = computed(
  () => store.currentConversation?.subject || t("communication.thread.untitled", { id: props.id }),
);
const draft = ref("");
const sendError = ref("");
const scroller = ref<HTMLElement | null>(null);

const { start, stop } = useCommStream({
  onMessageCreated: store.applyMessageCreated,
  onUnreadChanged: store.applyUnreadChanged,
  onConversationClosed: store.applyConversationClosed,
});

async function scrollToBottom(): Promise<void> {
  await nextTick();
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight });
}

async function load(): Promise<void> {
  await store.fetchThread(conversationId.value);
  await scrollToBottom();
}

function goBack(): void {
  store.leaveThread();
  router.push({ name: "communication-list" });
}

async function submit(): Promise<void> {
  const text = draft.value.trim();
  if (text === "") return;
  sendError.value = "";
  draft.value = "";
  try {
    await store.sendMessage(text);
    await scrollToBottom();
  } catch (e) {
    sendError.value = e instanceof Error ? e.message : t("communication.thread.send_error");
    draft.value = text; // no perder lo escrito si falló
  }
}

async function closeTicket(): Promise<void> {
  if (!window.confirm(t("communication.thread.close_confirm"))) return;
  await store.closeCurrentTicket();
}

watch(
  () => store.messages.length,
  () => void scrollToBottom(),
);

onMounted(() => {
  void load();
  void start();
});

onUnmounted(() => {
  stop();
  store.leaveThread();
});
</script>

<template>
  <div class="communication-thread d-flex flex-column fill-height">
    <div class="d-flex align-center pa-3 border-b">
      <v-btn icon="mdi-arrow-left" variant="text" density="comfortable" @click="goBack" />
      <div class="ml-2 flex-grow-1">
        <div class="text-subtitle-1 font-weight-medium">
          {{ displayTitle }}
        </div>
        <div class="text-caption text-medium-emphasis">
          {{ store.currentConversation?.contact?.name ?? "" }}
        </div>
      </div>
      <v-chip
        v-if="store.currentConversation"
        :color="store.currentConversation.is_open ? 'success' : 'grey'"
        size="small"
        label
        class="mr-2"
      >
        {{
          store.currentConversation.is_open
            ? t("communication.status.open")
            : t("communication.status.closed")
        }}
      </v-chip>
      <v-btn
        v-if="store.currentConversation?.is_open"
        variant="tonal"
        size="small"
        prepend-icon="mdi-check"
        @click="closeTicket"
      >
        {{ t("communication.thread.close") }}
      </v-btn>
    </div>

    <div ref="scroller" class="flex-grow-1 overflow-y-auto pa-4">
      <div v-if="store.loadingThread" class="d-flex justify-center py-6">
        <v-progress-circular indeterminate color="primary" />
      </div>
      <template v-else>
        <div v-if="!store.messages.length" class="text-medium-emphasis text-center py-6">
          {{ t("communication.thread.empty") }}
        </div>
        <TicketMessageBubble
          v-for="m in store.messages"
          :key="m.id"
          :message="m"
        />
      </template>
    </div>

    <div class="pa-3 border-t">
      <div v-if="sendError" class="text-error text-caption mb-1">{{ sendError }}</div>
      <div class="d-flex ga-2 align-end">
        <v-textarea
          v-model="draft"
          :placeholder="t('communication.thread.placeholder')"
          rows="1"
          auto-grow
          max-rows="6"
          hide-details
          density="comfortable"
          :disabled="store.currentConversation?.is_open === false"
          @keydown.enter.exact.prevent="submit"
        />
        <v-btn
          icon="mdi-send"
          color="primary"
          size="large"
          :loading="store.sending"
          :disabled="draft.trim() === '' || store.currentConversation?.is_open === false"
          @click="submit"
        />
      </div>
    </div>
  </div>
</template>
