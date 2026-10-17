import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { chatService, type UnreadCounter } from '@shared/services/chat.service';

/**
 * Chat store — tracks the aggregate unread counter that drives the
 * topbar badge, plus the per-shipment "is typing…" indicator.
 *
 * The counter is fetched lazily (call refresh() once on app boot) and
 * then refreshed on demand whenever the SSE stream emits an
 * `unread_count_changed` event. We never poll on a timer — this
 * counter rolls up every shipment the caller is a party to, and the
 * SQL behind it is the most expensive query in the chat surface.
 */
export const useChatStore = defineStore('chat', () => {
  const counter = ref<UnreadCounter | null>(null);

  /** True when any shipment area (express, cargo, crm) has unread items. */
  const hasUnread = computed<boolean>(() => {
    const c = counter.value;
    return !!c && c.total > 0;
  });

  /**
   * Map of shipment_id → expiration timestamp. Entries older than
   * TYPING_EXPIRATION_MS are considered stale and pruned on access.
   * The SSE stream re-publishes `typing` while a user keeps typing
   * (debounced 2s on the sender), so a 5s expiration window leaves
   * plenty of slack for network jitter without keeping ghosts on the
   * screen after the sender stops.
   */
  const TYPING_EXPIRATION_MS = 5000;
  const typingByShipment = ref<Map<number, number>>(new Map());

  function isTyping(shipment_id: number | null): boolean {
    if (shipment_id === null) return false;
    const expires = typingByShipment.value.get(shipment_id);
    if (expires === undefined) return false;
    if (expires <= Date.now()) {
      typingByShipment.value.delete(shipment_id);
      return false;
    }
    return true;
  }

  function markTyping(shipment_id: number): void {
    const next = new Map(typingByShipment.value);
    next.set(shipment_id, Date.now() + TYPING_EXPIRATION_MS);
    typingByShipment.value = next;
  }

  async function refresh(): Promise<void> {
    try {
      const r = await chatService.unreadCounter();
      if (r.success) counter.value = r.data;
    } catch {
      // Badge is best-effort — failure means the topbar dot stays
      // whatever value it currently shows, no fatal toast.
    }
  }

  function reset(): void {
    counter.value = null;
    typingByShipment.value = new Map();
  }

  return {
    counter,
    hasUnread,
    refresh,
    reset,
    isTyping,
    markTyping,
  };
});
