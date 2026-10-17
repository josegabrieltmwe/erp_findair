/**
 * Tipos del dominio Communication (contrato `api_communication_*`, fase A2/A2b).
 * Fase 1 de este módulo: solo tickets (kind "ticket") — shipment_chat y customs
 * quedan fuera (ver plan).
 */

export type ConversationKind = "ticket" | "shipment_chat" | "customs";
export type ConversationStatusFilter = "open" | "closed" | "all";
export type MessageFrom = "mine" | "others";

export interface ConversationShipment {
  id: number;
  type: "cargo" | "express";
}

export interface ConversationContact {
  name: string;
  email: string;
}

export interface ConversationLastMessage {
  id: number;
  body_preview: string;
  sent_at: string;
  from: MessageFrom;
}

/** Item del listado (`GET api_communication_conversations`). */
export interface Conversation {
  id: string; // "ticket:<id>"
  kind: ConversationKind;
  subject: string;
  is_open: boolean;
  awaiting_reply: boolean;
  unread_count: number;
  shipment: ConversationShipment | null;
  last_message: ConversationLastMessage | null;
  message_count: number;
  opened_at: string;
  contact: ConversationContact;
}

export interface MessageSender {
  user_id: number;
  name: string;
  company_id: number;
  company_name: string;
  is_me: boolean;
}

export interface MessageTranslation {
  lang: string;
  text: string;
  source_lang: string;
  status: "ready" | "pending" | "skipped";
  auto: boolean;
}

/** Mensaje de un hilo (`GET/POST api_communication_messages`). */
export interface CommMessage {
  id: number;
  conversation_id: string;
  body: string;
  sent_at: string;
  client_uuid: string | null;
  sender: MessageSender;
  from: MessageFrom;
  read_by_me: boolean;
  attachment: unknown | null;
  translation: MessageTranslation | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ConversationsListResult {
  items: Conversation[];
  pagination: Pagination;
  unread_total: number;
}

export interface MessagesListResult {
  items: CommMessage[];
  has_more: boolean;
  conversation: { id: string; is_open: boolean; unread_count: number };
}

export interface OpenTicketPayload {
  subject: string;
  body: string;
  consent: true;
  shipment_id?: number;
  shipment_type?: "cargo" | "express";
  name?: string;
  email?: string;
  telephone?: string;
  client_uuid: string;
}

export interface OpenTicketResult {
  conversation: Conversation;
  message: CommMessage;
  duplicate: boolean;
}

export interface SendMessageResult {
  message: CommMessage;
  duplicate: boolean;
}

export interface StreamTokenResult {
  token: string;
  expires_in: number;
  stream_url: string;
}

/** Envelope estándar de `api_communication_*` ({success, data}). */
export interface Envelope<T> {
  success: boolean;
  data: T;
}

/** Eventos del daemon SSE (contrato 2.5) que consume esta fase. */
export interface CommMessageCreatedEvent {
  conversation_id: string;
  message: CommMessage;
}

export interface CommUnreadChangedEvent {
  conversation_id: string;
  unread_count: number;
  unread_total: number;
}

export interface CommConversationClosedEvent {
  conversation_id: string;
  [key: string]: unknown;
}
