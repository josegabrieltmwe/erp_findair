/**
 * Capa de acceso a los endpoints `api_communication_*` (contrato A2/A2b).
 * Usa el http client compartido (@shared/anagrafiche/services/http): ofetch con
 * baseURL = __TMWE_NAV__.basePath, sesión (credentials:include) — igual que crm.
 *
 * Fase 1: solo tickets (kind "ticket"). Endpoints (config/routes/communication*.yml,
 * hybrid auth sesión+Bearer):
 *   api_communication_conversations  GET lista / POST abrir / PUT cerrar
 *   api_communication_messages       GET lista / POST enviar / PUT marcar leído
 *   api_communication_stream_token   POST (SSE, contrato 2.4)
 */
import { http } from "@shared/anagrafiche/services/http";
import type {
  ConversationsListResult,
  ConversationStatusFilter,
  Envelope,
  MessagesListResult,
  OpenTicketPayload,
  OpenTicketResult,
  SendMessageResult,
  StreamTokenResult,
} from "../types";

export interface ConversationsListFilters {
  status?: ConversationStatusFilter;
  search?: string;
}

function genClientUuid(): string {
  // crypto.randomUUID() existe en todos los navegadores soportados por esta SPA.
  return `tmp_${Date.now()}_${crypto.randomUUID()}`;
}

export const communicationService = {
  async listConversations(
    filters: ConversationsListFilters,
    page: number,
    perPage: number,
  ): Promise<ConversationsListResult> {
    const query: Record<string, string> = {
      kind: "ticket",
      page: String(page),
      limit: String(perPage),
    };
    if (filters.status && filters.status !== "all") query.status = filters.status;
    if (filters.search) query.search = filters.search;
    const res = await http<Envelope<ConversationsListResult>>(
      "/api_communication_conversations",
      { method: "GET", query },
    );
    return res.data;
  },

  /** Abre un ticket nuevo. `client_uuid` se genera aquí si no se pasa (idempotencia). */
  async openTicket(
    payload: Omit<OpenTicketPayload, "client_uuid" | "consent"> & {
      client_uuid?: string;
    },
  ): Promise<OpenTicketResult> {
    const res = await http<Envelope<OpenTicketResult>>(
      "/api_communication_conversations",
      {
        method: "POST",
        body: {
          ...payload,
          consent: true,
          client_uuid: payload.client_uuid ?? genClientUuid(),
        },
      },
    );
    return res.data;
  },

  async closeTicket(conversationId: string): Promise<void> {
    await http("/api_communication_conversations", {
      method: "PUT",
      body: { conversation_id: conversationId, status: "closed" },
    });
  },

  async listMessages(
    conversationId: string,
    limit = 100,
  ): Promise<MessagesListResult> {
    const res = await http<Envelope<MessagesListResult>>(
      "/api_communication_messages",
      { method: "GET", query: { conversation_id: conversationId, limit: String(limit) } },
    );
    return res.data;
  },

  async sendMessage(
    conversationId: string,
    body: string,
    clientUuid?: string,
  ): Promise<SendMessageResult> {
    const res = await http<Envelope<SendMessageResult>>(
      "/api_communication_messages",
      {
        method: "POST",
        body: {
          conversation_id: conversationId,
          body,
          client_uuid: clientUuid ?? genClientUuid(),
        },
      },
    );
    return res.data;
  },

  async markRead(conversationId: string, upToMessageId: number): Promise<void> {
    await http("/api_communication_messages", {
      method: "PUT",
      body: { conversation_id: conversationId, up_to_message_id: upToMessageId },
    });
  },

  /** `scope`: "all" (badge global) o un conversation_id concreto (hilo abierto). */
  async issueStreamToken(scope: string = "all"): Promise<StreamTokenResult> {
    const res = await http<Envelope<StreamTokenResult>>(
      "/api_communication_stream_token",
      { method: "POST", body: { scope } },
    );
    return res.data;
  },
};
