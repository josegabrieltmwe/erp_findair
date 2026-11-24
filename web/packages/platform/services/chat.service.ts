import { http } from './http';

/**
 * Chat service — talks to the modern hybrid surface (`web_chat_*`).
 * Replaces the previous adapter pointing at the legacy `spedy_chat`
 * route. See docs/api/chat_modern_api.md for the full contract.
 */

export type ShipmentType = 'express' | 'cargo';

export interface ChatSender {
  user_id: number;
  user_name: string | null;
  company_id: number;
  company_name: string | null;
  company_short_name: string | null;
  email: string | null;
  is_me: boolean;
}

export interface ChatAttachment {
  file_name: string;
  file_size_kb: number;
}

export interface ChatMessage {
  id: number;
  shipment_id: number;
  shipment_type: ShipmentType;
  body: string;
  /** ISO 8601 UTC timestamp ("YYYY-MM-DDTHH:MM:SSZ"). */
  sent_at: string;
  sender: ChatSender;
  read_by_me: boolean;
  has_attachment: boolean;
  attachment: ChatAttachment | null;
}

export interface ChatListData {
  messages: ChatMessage[];
  total: number;
  unread: number;
}

export interface ChatListResponse {
  success: boolean;
  data: ChatListData;
}

export interface ChatSendResponse {
  success: boolean;
  data: { message: ChatMessage };
}

export interface ChatMarkReadResponse {
  success: boolean;
  data: { marked_ids: number[] };
}

export interface ChatTypingResponse {
  success: boolean;
  data: { status: 'sent' };
}

export interface ChatTranslateResponse {
  success: boolean;
  data: { translated_body: string; target_lang: string };
}

export interface UnreadCounter {
  express: number;
  cargo: number;
  crm: number;
  crm_not_in_to_do: number;
  total: number;
}

export interface UnreadCounterResponse {
  success: boolean;
  data: UnreadCounter;
}

export const chatService = {
  /**
   * List every active message for a shipment, newest first.
   * Pass `created_after` (ISO 8601) for incremental delta polling.
   */
  list(
    shipment_id: number,
    shipment_type: ShipmentType = 'express',
    created_after?: string,
  ): Promise<ChatListResponse> {
    const query: Record<string, string | number> = { shipment_id, shipment_type };
    if (created_after) query.created_after = created_after;
    return http('/web_chat_messages', { query });
  },

  /**
   * Persist a new message. Body is trimmed and limited to 4000 chars
   * server-side; the client should mirror that for nicer UX.
   *
   * `X-Busy: off`: the drawer has its own `sending` spinner on the send
   * button, so this doesn't need the shell's global "processing…" modal
   * (same reasoning as `typing()` above) — a full-screen scrim just to
   * send a chat line is more interruption than the action warrants.
   */
  send(
    shipment_id: number,
    body: string,
    shipment_type: ShipmentType = 'express',
  ): Promise<ChatSendResponse> {
    return http('/web_chat_messages', {
      method: 'POST',
      headers: { 'X-Busy': 'off' },
      body: { shipment_id, shipment_type, body },
    });
  },

  /**
   * Mark the given messages as read for the caller's role on the shipment.
   * Messages authored by the caller are silently filtered out server-side.
   */
  markRead(
    shipment_id: number,
    message_ids: number[],
    shipment_type: ShipmentType = 'express',
  ): Promise<ChatMarkReadResponse> {
    return http('/web_chat_messages', {
      method: 'PUT',
      body: { shipment_id, shipment_type, message_ids },
    });
  },

  /**
   * Publish a "is typing…" indicator to the fanout exchange.
   * Caller MUST debounce to at most one call every 2 seconds.
   *
   * `X-Busy: off`: best-effort background ping fired on every keystroke —
   * without it, the shell's global "processing…" modal (installBffFetch's
   * busy counter, shared-frontend/src/http/bff.ts) flashed open/closed on
   * every debounced call, interrupting the user mid-typing. Same opt-out
   * the copilot chat already uses via BUSY_IGNORED.
   */
  typing(
    shipment_id: number,
    shipment_type: ShipmentType = 'express',
  ): Promise<ChatTypingResponse> {
    return http('/web_chat_typing', {
      method: 'POST',
      headers: { 'X-Busy': 'off' },
      body: { shipment_id, shipment_type },
    });
  },

  /**
   * Aggregate unread counters for the topbar badge.
   * Scoped to the caller's anagrafica id (no shipment filter).
   */
  unreadCounter(): Promise<UnreadCounterResponse> {
    return http('/web_chat_unread_counter');
  },

  /**
   * Translate a single message on demand. `target_lang` is whatever the
   * caller picked in the UI (not tied to session/interface language) —
   * see docs/contrato-con-api.md §X (P146). Pending backend: this calls
   * an action that doesn't exist in tmwe_api/the BFF manifest yet, so it
   * 404s until P146 ships; the caller's error handling already surfaces
   * that as a toast.
   *
   * `X-Busy: off`: this is a per-message action with its own local
   * spinner (same reasoning as `typing()`/`send()`) — not worth the
   * shell's global "processing…" modal.
   */
  translate(
    message_id: number,
    shipment_id: number,
    target_lang: string,
    shipment_type: ShipmentType = 'express',
  ): Promise<ChatTranslateResponse> {
    return http('/web_chat_translate_message', {
      method: 'POST',
      headers: { 'X-Busy': 'off' },
      body: { message_id, shipment_id, shipment_type, target_lang },
    });
  },
};
