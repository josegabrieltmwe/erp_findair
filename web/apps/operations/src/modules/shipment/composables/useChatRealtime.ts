import { onBeforeUnmount, onMounted, type Ref } from "vue";

import { useChatStore } from "@shipment/stores/chat.store";

/**
 * Chat realtime composable — polling implementation.
 *
 * History: this used to open a long-lived SSE connection to
 * `/web_chat_realtime_stream`. With PHP-FPM `pm.max_children=5` each
 * open SSE permanently parked one worker. Two browser tabs of the SPA
 * consumed 2 of the 5 workers and a third tab couldn't get served,
 * making the whole UI hang. We swapped the SSE for plain polling
 * against `/web_chat_unread_counter` (cheap ~50ms call), which keeps
 * the badge fresh without blocking workers.
 *
 * Trade-offs vs the previous SSE design:
 *   - `unread_count_changed` → derived from polling delta (15s default).
 *   - `new_message` for the drawer → fired when the badge counter
 *     INCREASES while the host page is viewing a shipment. The drawer
 *     re-fetches its message list to surface the newcomer. We do NOT
 *     receive the message_id/sender_company_id ahead of time — the
 *     drawer is expected to handle a generic refresh.
 *   - `read_receipt` push → no longer pushed by the server. Each
 *     ChatDrawer should poll its own state if precise read receipts
 *     are required (the in-shipment chat already does so).
 *   - `typing` push → no longer received. The store API still works
 *     and any code path that calls `markTyping` keeps the UX bit
 *     usable in case it's wired by a future endpoint.
 *
 * The polling cadence (15s) is tuned to match the wall-clock latency
 * the SSE used to deliver in practice (the legacy stream was 15s
 * heartbeat). If we ever go back to SSE we can simply restore the
 * previous version of this file — the contract is identical.
 */

export interface ChatRealtimeOptions {
  /** The shipment currently being viewed; used to decide whether the
   *  `onMessage` callback should fire when the badge increases. */
  currentShipmentId?: Ref<number | null>;
  /** Called when the unread counter goes UP while a shipment is open.
   *  The drawer should re-fetch its message list. We do not pass the
   *  full message payload — the polling design only sees aggregates. */
  onMessage?: (payload: { shipment_id: number }) => void;
  /** Kept for source compatibility with the previous SSE-based version.
   *  No longer invoked — the polling design has no read-receipt push. */
  onReadReceipt?: (payload: unknown) => void;
}

export interface NewMessagePayload {
  shipment_id: number;
  shipment_type: "E" | "C";
  message_id: number;
  sender_company_id: number;
  sender_contact_id: number;
  sender_name?: string;
}

export interface ReadReceiptPayload {
  shipment_id: number;
  shipment_type: "E" | "C";
  message_ids: number[];
  reader_company_id: number;
}

export interface TypingPayload {
  shipment_id: number;
  shipment_type: "E" | "C";
  sender_company_id: number;
}

/** Default poll cadence (ms). 15s mirrors the legacy SSE heartbeat. */
const POLL_INTERVAL_MS = 15_000;

/**
 * Open the badge polling loop for the lifetime of the host component.
 * Mounting twice in the same app double-polls — same contract as the
 * SSE version, callers must mount at most once.
 */
export function useChatRealtime(options: ChatRealtimeOptions = {}): void {
  const chat = useChatStore();
  let timer: number | null = null;
  let stopped = false;
  let lastTotal = 0;

  async function tick(): Promise<void> {
    if (stopped) return;
    const previous = chat.counter?.total ?? lastTotal;
    await chat.refresh();
    const current = chat.counter?.total ?? previous;
    lastTotal = current;

    if (current > previous && options.onMessage) {
      const sid = options.currentShipmentId?.value ?? null;
      if (sid !== null) {
        options.onMessage({ shipment_id: sid });
      }
    }
  }

  function start(): void {
    if (timer !== null || stopped) return;
    timer = window.setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);
  }

  function stop(): void {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  onMounted(() => {
    // Seed the badge immediately on mount so the topbar doesn't render
    // a stale "no unread" dot for the first few seconds.
    void chat.refresh().then(() => {
      lastTotal = chat.counter?.total ?? 0;
    });
    start();
  });

  onBeforeUnmount(() => {
    stopped = true;
    stop();
  });
}
