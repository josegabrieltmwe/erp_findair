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
        :title="t('shipment.chat.close')"
        @click="ui.closeAllDrawers()"
      />
      <aside class="chatdrawer" :class="{ 'is-open': ui.chatOpen }">
        <div class="chat-h">
          <v-icon icon="mdi-chat-outline" size="16" />
          <h3>{{ t("shipment.chat.partner_title") }}</h3>
          <button
            type="button"
            class="mclose"
            :title="t('shipment.chat.close')"
            @click="ui.closeAllDrawers()"
          >
            <v-icon icon="mdi-close" size="16" />
          </button>
        </div>

        <div ref="msgsRef" class="chat-msgs">
          <div v-if="loading && !messages.length" class="chat-empty">
            {{ t("shipment.chat.loading") }}
          </div>
          <div v-else-if="!messages.length" class="chat-empty">
            {{ t("shipment.chat.no_messages") }}
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
            <span class="chat-typing-lbl">{{ t("shipment.chat.typing") }}</span>
          </div>
        </div>

        <form class="chat-input" @submit.prevent="onSubmit">
          <input
            v-model="draft"
            type="text"
            :placeholder="t('shipment.chat.write_ph')"
            :disabled="sending || !shipmentId"
            maxlength="4000"
            @input="onTyping"
          />
          <button
            type="submit"
            class="chat-send"
            :title="t('shipment.chat.send')"
            :disabled="sending || !draft.trim() || !shipmentId"
          >
            <v-icon icon="mdi-send" size="16" />
          </button>
        </form>
      </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useTheme } from "vuetify";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import { useToastStore } from "@shipment/stores/toast.store";
import { useChatStore } from "@shipment/stores/chat.store";
import {
  chatService,
  type ChatMessage,
  type ShipmentType,
} from "@shipment/services/chat.service";

const { t } = useI18n();
const ui = useUiStore();
const store = useShipmentStore();
const toasts = useToastStore();
const chatStore = useChatStore();
const theme = useTheme();
const activeTheme = computed(() => theme.global.name.value);
const { id } = storeToRefs(store);

const shipmentId = computed<number | null>(() => id.value);
const shipmentType: ShipmentType = "express";

/** True when the chat store reports someone is typing on THIS shipment.
 *  The store keeps an expiration window (5s) so the indicator hides
 *  itself a few seconds after the last `typing` event. */
const remoteTyping = computed<boolean>(() =>
  chatStore.isTyping(shipmentId.value),
);

const messages = ref<ChatMessage[]>([]);
const draft = ref("");
const sending = ref(false);
const loading = ref(false);
const msgsRef = ref<HTMLDivElement | null>(null);

/** Debounce window for typing notifications. The server makes no
 *  attempt to throttle, so the client is responsible for not flooding
 *  the broker. Mirrors the contract in docs/api/chat_modern_api.md §8. */
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
  if (!shipmentId.value) return;
  loading.value = true;
  try {
    const r = await chatService.list(shipmentId.value, shipmentType);
    if (!r.success) return;
    // Server returns newest-first; we reverse so the latest sits at the
    // bottom of the scrolling area, matching every other chat UI.
    messages.value = [...r.data.messages].reverse();
    await nextTick();
    scrollToBottom();
    // Mark every unread message authored by another party as read.
    const unreadIds = messages.value
      .filter((m) => !m.read_by_me && !m.sender.is_me)
      .map((m) => m.id);
    if (unreadIds.length) {
      try {
        await chatService.markRead(shipmentId.value, unreadIds, shipmentType);
        for (const m of messages.value) {
          if (unreadIds.includes(m.id)) m.read_by_me = true;
        }
      } catch {
        // Mark-read failures are non-fatal — the message is already on
        // screen, the receipt will retry on the next open.
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
  if (!shipmentId.value || !draft.value.trim() || sending.value) return;
  sending.value = true;
  try {
    const r = await chatService.send(
      shipmentId.value,
      draft.value.trim(),
      shipmentType,
    );
    if (!r.success) {
      toasts.push("error", t("shipment.chat.send_failed"));
      return;
    }
    messages.value.push(r.data.message);
    draft.value = "";
    await nextTick();
    scrollToBottom();
  } catch (e) {
    toasts.push(
      "error",
      (e as Error).message || t("shipment.chat.send_failed"),
    );
  } finally {
    sending.value = false;
  }
}

/**
 * Send a typing indicator at most once every TYPING_DEBOUNCE_MS.
 * The first keystroke fires immediately; subsequent keystrokes within
 * the window are coalesced into a single trailing call when the timer
 * expires (only if the user kept typing past the leading edge).
 */
function onTyping(): void {
  if (!shipmentId.value) return;
  if (typingTimer !== null) return;
  void chatService.typing(shipmentId.value, shipmentType).catch(() => {
    // Typing is best-effort; ignore network errors so the input stays
    // responsive even if the broker is briefly unreachable.
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
  [() => ui.chatOpen, shipmentId],
  ([open, sid]) => {
    if (open && sid) void loadMessages();
  },
  { immediate: true },
);

/**
 * Append a new message that arrived via SSE while the drawer was open.
 * Re-fetches only the delta (everything strictly newer than our latest
 * cached message) so we don't double-render the same id if the SSE
 * raced ahead of the user's own send acknowledgement.
 */
async function appendLiveMessage(): Promise<void> {
  if (!shipmentId.value || !ui.chatOpen) return;
  const latest = messages.value[messages.value.length - 1];
  const since = latest ? latest.sent_at : undefined;
  try {
    const r = await chatService.list(shipmentId.value, shipmentType, since);
    if (!r.success || !r.data.messages.length) return;
    const known = new Set(messages.value.map((m) => m.id));
    const fresh = [...r.data.messages]
      .reverse()
      .filter((m) => !known.has(m.id));
    if (!fresh.length) return;
    messages.value.push(...fresh);
    await nextTick();
    scrollToBottom();
    // Mark these as read since the drawer is visible.
    const unreadIds = fresh
      .filter((m) => !m.read_by_me && !m.sender.is_me)
      .map((m) => m.id);
    if (unreadIds.length) {
      try {
        await chatService.markRead(shipmentId.value, unreadIds, shipmentType);
        for (const m of messages.value) {
          if (unreadIds.includes(m.id)) m.read_by_me = true;
        }
      } catch {
        /* see loadMessages() rationale */
      }
    }
  } catch {
    // Delta poll is best-effort; the next SSE event or drawer reopen
    // will reconcile.
  }
}

defineExpose({ appendLiveMessage });
</script>
