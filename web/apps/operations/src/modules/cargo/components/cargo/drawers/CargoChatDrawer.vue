<template>
  <Teleport to="body">
    <div
      class="shipment-v2 v-application"
      :class="`v-theme--${activeTheme}`"
      :data-theme="ui.v2Theme"
    >
      <button
        v-if="ui.chatOpen"
        class="backdrop"
        type="button"
        :title="t('common.close')"
        @click="ui.closeAllDrawers()"
      />
      <aside class="chatdrawer" :class="{ 'is-open': ui.chatOpen }">
        <div class="chat-h">
          <v-icon icon="mdi-chat-outline" size="16" />
          <h3>{{ t("cargo.chat.title") }}</h3>
          <button
            type="button"
            class="mclose"
            :title="t('common.close')"
            @click="ui.closeAllDrawers()"
          >
            <v-icon icon="mdi-close" size="16" />
          </button>
        </div>

        <div ref="msgsRef" class="chat-msgs">
          <div v-if="loading && !messages.length" class="chat-empty">
            {{ t("cargo.chat.loading") }}
          </div>
          <div v-else-if="!messages.length" class="chat-empty">
            {{ t("cargo.chat.empty") }}
          </div>
          <div
            v-for="m in messages"
            :key="m.id"
            class="cmsg"
            :class="m.sender.is_me ? 'me' : 'them'"
          >
            <div class="cfrom">{{ author(m) }}</div>
            {{ m.body }}
            <div class="ctime">{{ formatWhen(m.sent_at) }}</div>
          </div>
          <div v-if="remoteTyping" class="cmsg them chat-typing">
            <span class="chat-typing-dots"><i /><i /><i /></span>
            <span class="chat-typing-lbl">{{ t("cargo.chat.typing") }}</span>
          </div>
        </div>

        <form class="chat-input" @submit.prevent="onSubmit">
          <input
            v-model="draft"
            type="text"
            :placeholder="t('cargo.chat.write_message')"
            :disabled="sending || !cargoId"
            maxlength="4000"
            @input="onTyping"
          />
          <button
            type="submit"
            class="chat-send"
            :title="t('common.send')"
            :disabled="sending || !draft.trim() || !cargoId"
          >
            <v-icon icon="mdi-send" size="16" />
          </button>
        </form>
      </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useTheme } from "vuetify";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import { useToastStore } from "@cargo/stores/toast.store";
import { useChatStore } from "@cargo/stores/chat.store";
import {
  chatService,
  type ChatMessage,
  type ShipmentType,
} from "@cargo/services/chat.service";

const { t } = useI18n();
const ui = useUiStore();
const store = useCargoStore();
const toasts = useToastStore();
const chatStore = useChatStore();
const theme = useTheme();
const activeTheme = computed(() => theme.global.name.value);
const { id } = storeToRefs(store);

/**
 * Cargo chat uses the same modern `/web_chat_messages` endpoint as
 * shipment_express; the backend service distinguishes the two via the
 * `shipment_type` parameter (mapped to legacy `chat_servizio.tipo`
 * column 'E' vs 'C'). The realtime SSE stream is anagrafica-scoped and
 * therefore agnostic of the entity type.
 */
const cargoId = computed<number | null>(() =>
  typeof id.value === "number" ? id.value : id.value ? Number(id.value) : null,
);
const shipmentType: ShipmentType = "cargo";

const remoteTyping = computed<boolean>(() => chatStore.isTyping(cargoId.value));

const messages = ref<ChatMessage[]>([]);
const draft = ref("");
const sending = ref(false);
const loading = ref(false);
const msgsRef = ref<HTMLDivElement | null>(null);

const TYPING_DEBOUNCE_MS = 2000;
let typingTimer: number | null = null;

function author(m: ChatMessage): string {
  return (
    m.sender.user_name ||
    m.sender.company_short_name ||
    m.sender.company_name ||
    `User ${m.sender.user_id}`
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const months = [
    "gen",
    "feb",
    "mar",
    "apr",
    "mag",
    "giu",
    "lug",
    "ago",
    "set",
    "ott",
    "nov",
    "dic",
  ];
  const d = dt.getDate();
  const mo = months[dt.getMonth()];
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${d} ${mo} · ${hh}:${mm}`;
}

async function loadMessages(): Promise<void> {
  if (!cargoId.value) return;
  loading.value = true;
  try {
    const r = await chatService.list(cargoId.value, shipmentType);
    if (!r.success) return;
    messages.value = [...r.data.messages].reverse();
    await nextTick();
    scrollToBottom();
    const unreadIds = messages.value
      .filter((m) => !m.read_by_me && !m.sender.is_me)
      .map((m) => m.id);
    if (unreadIds.length) {
      try {
        await chatService.markRead(cargoId.value, unreadIds, shipmentType);
        for (const m of messages.value) {
          if (unreadIds.includes(m.id)) m.read_by_me = true;
        }
      } catch {
        /* mark-read best-effort */
      }
    }
  } finally {
    loading.value = false;
  }
}

function scrollToBottom(): void {
  if (msgsRef.value) msgsRef.value.scrollTop = msgsRef.value.scrollHeight;
}

async function onSubmit(): Promise<void> {
  if (!cargoId.value || !draft.value.trim() || sending.value) return;
  sending.value = true;
  try {
    const r = await chatService.send(
      cargoId.value,
      draft.value.trim(),
      shipmentType,
    );
    if (!r.success) {
      toasts.push("error", t("cargo.chat.send_failed"));
      return;
    }
    messages.value.push(r.data.message);
    draft.value = "";
    await nextTick();
    scrollToBottom();
  } catch (e) {
    toasts.push("error", (e as Error).message || t("cargo.chat.send_failed"));
  } finally {
    sending.value = false;
  }
}

function onTyping(): void {
  if (!cargoId.value) return;
  if (typingTimer !== null) return;
  void chatService.typing(cargoId.value, shipmentType).catch(() => {
    /* best-effort */
  });
  typingTimer = window.setTimeout(() => {
    typingTimer = null;
  }, TYPING_DEBOUNCE_MS);
}

onBeforeUnmount(() => {
  if (typingTimer !== null) {
    window.clearTimeout(typingTimer);
    typingTimer = null;
  }
});

watch(
  [() => ui.chatOpen, cargoId],
  ([open, cid]) => {
    if (open && cid) void loadMessages();
  },
  { immediate: true },
);

async function appendLiveMessage(): Promise<void> {
  if (!cargoId.value || !ui.chatOpen) return;
  const latest = messages.value[messages.value.length - 1];
  const since = latest ? latest.sent_at : undefined;
  try {
    const r = await chatService.list(cargoId.value, shipmentType, since);
    if (!r.success || !r.data.messages.length) return;
    const known = new Set(messages.value.map((m) => m.id));
    const fresh = [...r.data.messages]
      .reverse()
      .filter((m) => !known.has(m.id));
    if (!fresh.length) return;
    messages.value.push(...fresh);
    await nextTick();
    scrollToBottom();
    const unreadIds = fresh
      .filter((m) => !m.read_by_me && !m.sender.is_me)
      .map((m) => m.id);
    if (unreadIds.length) {
      try {
        await chatService.markRead(cargoId.value, unreadIds, shipmentType);
        for (const m of messages.value) {
          if (unreadIds.includes(m.id)) m.read_by_me = true;
        }
      } catch {
        /* see loadMessages */
      }
    }
  } catch {
    /* delta poll is best-effort */
  }
}

defineExpose({ appendLiveMessage });
</script>
