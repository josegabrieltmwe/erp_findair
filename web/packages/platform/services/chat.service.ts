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
   */
  send(
    shipment_id: number,
    body: string,
    shipment_type: ShipmentType = 'express',
  ): Promise<ChatSendResponse> {
    return http('/web_chat_messages', {
      method: 'POST',
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
   */
  typing(
    shipment_id: number,
    shipment_type: ShipmentType = 'express',
  ): Promise<ChatTypingResponse> {
    return http('/web_chat_typing', {
      method: 'POST',
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
};
