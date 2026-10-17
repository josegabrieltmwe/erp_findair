import { defineStore } from "pinia";
import { ref } from "vue";

import {
  communicationService,
  type ConversationsListFilters,
} from "../services/communication.service";
import type {
  CommConversationClosedEvent,
  CommMessage,
  CommMessageCreatedEvent,
  CommUnreadChangedEvent,
  Conversation,
  ConversationStatusFilter,
  OpenTicketPayload,
} from "../types";

export const useCommunicationStore = defineStore("communication", () => {
  // ─── Lista ───────────────────────────────────────────────────
  const items = ref<Conversation[]>([]);
  const total = ref(0);
  const page = ref(1);
  const perPage = ref(25);
  const filters = ref<ConversationsListFilters>({ status: "open" });
  const unreadTotal = ref(0);
  const loadingList = ref(false);

  // ─── Hilo abierto ────────────────────────────────────────────
  const currentId = ref<string | null>(null);
  const currentConversation = ref<Conversation | null>(null);
  const messages = ref<CommMessage[]>([]);
  const loadingThread = ref(false);
  const sending = ref(false);

  async function fetchList(): Promise<void> {
    loadingList.value = true;
    try {
      const res = await communicationService.listConversations(
        filters.value,
        page.value,
        perPage.value,
      );
      items.value = res.items ?? [];
      total.value = res.pagination?.total ?? 0;
      unreadTotal.value = res.unread_total ?? 0;
    } finally {
      loadingList.value = false;
    }
  }

  async function setStatus(status: ConversationStatusFilter): Promise<void> {
    filters.value = { ...filters.value, status };
    page.value = 1;
    await fetchList();
  }

  async function setSearch(search: string): Promise<void> {
    filters.value = { ...filters.value, search };
    page.value = 1;
    await fetchList();
  }

  async function setPage(next: number): Promise<void> {
    if (next === page.value) return;
    page.value = next;
    await fetchList();
  }

  async function openTicket(
    payload: Omit<OpenTicketPayload, "client_uuid" | "consent">,
  ): Promise<Conversation> {
    const res = await communicationService.openTicket(payload);
    await fetchList();
    return res.conversation;
  }

  function findItem(conversationId: string): Conversation | undefined {
    return items.value.find((c) => c.id === conversationId);
  }

  async function fetchThread(conversationId: string): Promise<void> {
    currentId.value = conversationId;
    loadingThread.value = true;
    messages.value = [];
    currentConversation.value = findItem(conversationId) ?? null;
    if (!currentConversation.value && items.value.length === 0) {
      // Entrada directa por URL (sin pasar antes por la lista): GET api_communication_messages
      // no trae subject/contact (son del contrato de la lista, no del hilo — ver §2.2 vs §2.1),
      // así que se intenta una vez, best-effort, traer la lista para resolver el resumen completo.
      // Si el ticket no está en esa primera página (filtro/orden no coincide), el header cae al
      // fallback legible de displayTitle() en vez de mostrar el id interno "ticket:<n>".
      await fetchList().catch(() => {});
      currentConversation.value = findItem(conversationId) ?? null;
    }
    try {
      const res = await communicationService.listMessages(conversationId);
      if (currentId.value !== conversationId) return; // navegó a otro hilo mientras cargaba
      messages.value = res.items ?? [];
      if (currentConversation.value) {
        currentConversation.value = {
          ...currentConversation.value,
          is_open: res.conversation?.is_open ?? currentConversation.value.is_open,
        };
      }
      const lastMine = [...messages.value].reverse().find((m) => m.from === "others");
      if (lastMine) await communicationService.markRead(conversationId, lastMine.id).catch(() => {});
    } finally {
      if (currentId.value === conversationId) loadingThread.value = false;
    }
  }

  function leaveThread(): void {
    currentId.value = null;
    currentConversation.value = null;
    messages.value = [];
  }

  async function sendMessage(body: string): Promise<void> {
    const conversationId = currentId.value;
    if (!conversationId) return;
    sending.value = true;
    try {
      const res = await communicationService.sendMessage(conversationId, body);
      if (currentId.value === conversationId && !messages.value.some((m) => m.id === res.message.id)) {
        messages.value.push(res.message);
      }
    } finally {
      sending.value = false;
    }
  }

  async function closeCurrentTicket(): Promise<void> {
    const conversationId = currentId.value;
    if (!conversationId) return;
    await communicationService.closeTicket(conversationId);
    if (currentConversation.value) {
      currentConversation.value = { ...currentConversation.value, is_open: false };
    }
  }

  // ─── Eventos en vivo (useCommStream) ────────────────────────
  function applyMessageCreated(event: CommMessageCreatedEvent): void {
    if (event.conversation_id === currentId.value) {
      if (!messages.value.some((m) => m.id === event.message.id)) {
        messages.value.push(event.message);
      }
      if (event.message.from === "others") {
        void communicationService.markRead(event.conversation_id, event.message.id).catch(() => {});
      }
    }
    const row = findItem(event.conversation_id);
    if (row) {
      row.last_message = {
        id: event.message.id,
        body_preview: event.message.body.slice(0, 160),
        sent_at: event.message.sent_at,
        from: event.message.from,
      };
      row.message_count += 1;
    }
  }

  function applyUnreadChanged(event: CommUnreadChangedEvent): void {
    unreadTotal.value = event.unread_total;
    const row = findItem(event.conversation_id);
    if (row) row.unread_count = event.unread_count;
    if (currentConversation.value?.id === event.conversation_id) {
      currentConversation.value = { ...currentConversation.value, unread_count: event.unread_count };
    }
  }

  function applyConversationClosed(event: CommConversationClosedEvent): void {
    const row = findItem(event.conversation_id);
    if (row) row.is_open = false;
    if (currentConversation.value?.id === event.conversation_id) {
      currentConversation.value = { ...currentConversation.value, is_open: false };
    }
  }

  return {
    items,
    total,
    page,
    perPage,
    filters,
    unreadTotal,
    loadingList,
    currentId,
    currentConversation,
    messages,
    loadingThread,
    sending,
    fetchList,
    setStatus,
    setSearch,
    setPage,
    openTicket,
    fetchThread,
    leaveThread,
    sendMessage,
    closeCurrentTicket,
    applyMessageCreated,
    applyUnreadChanged,
    applyConversationClosed,
  };
});
