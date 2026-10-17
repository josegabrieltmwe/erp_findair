/**
 * Conexión SSE real contra el daemon de comunicación (`/comm_stream`, puerto 8091
 * en el servidor, contrato 2.4/2.5). Aparte y SIN relación con `useChatRealtime.ts`
 * (shipment/cargo): ese es el chat viejo (`web_chat_*`), *polling* puro pese al
 * nombre. Esto es tiempo real de verdad.
 *
 * El token de `api_communication_stream_token` es de UN SOLO USO y expira a los
 * 60s (Comm_Stream_Token_Service) — el EventSource nativo del navegador NO puede
 * reconectar solo a la misma URL (el segundo intento siempre fallaría). Por eso
 * la reconexión es manual: en cada `open()` se pide un token nuevo, y al perder
 * la conexión se cierra el EventSource ANTES de que el navegador programe su
 * propio reintento (ver MDN: `close()` dentro de `onerror` cancela esa reconexión
 * nativa) y se abre uno nuevo con backoff exponencial, pasando `last_event_id`
 * para no perder eventos (el daemon los repone desde `comm_event`).
 */
import { onUnmounted, ref } from "vue";

import { communicationService } from "../services/communication.service";
import type {
  CommConversationClosedEvent,
  CommMessageCreatedEvent,
  CommUnreadChangedEvent,
} from "../types";

export interface CommStreamHandlers {
  onMessageCreated?: (event: CommMessageCreatedEvent) => void;
  onUnreadChanged?: (event: CommUnreadChangedEvent) => void;
  onConversationClosed?: (event: CommConversationClosedEvent) => void;
}

const INITIAL_RECONNECT_MS = 2000;
const MAX_RECONNECT_MS = 30000;

export function useCommStream(handlers: CommStreamHandlers) {
  const connected = ref(false);

  let source: EventSource | null = null;
  let lastEventId: string | null = null;
  let reconnectDelay = INITIAL_RECONNECT_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function closeCurrent(): void {
    if (source) {
      source.close();
      source = null;
    }
    connected.value = false;
  }

  function scheduleReconnect(): void {
    if (stopped) return;
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => void open(), reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
  }

  function parsePayload<T>(raw: string): T | null {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null; // frame malformado: se ignora, no se rompe el stream.
    }
  }

  async function open(): Promise<void> {
    if (stopped) return;
    closeCurrent();

    let streamUrl: string;
    try {
      const issued = await communicationService.issueStreamToken("all");
      streamUrl = issued.stream_url;
    } catch {
      scheduleReconnect();
      return;
    }
    if (stopped) return;

    const url = lastEventId
      ? `${streamUrl}&last_event_id=${encodeURIComponent(lastEventId)}`
      : streamUrl;
    const es = new EventSource(url);
    source = es;

    es.addEventListener("connected", () => {
      connected.value = true;
      reconnectDelay = INITIAL_RECONNECT_MS;
    });

    es.addEventListener("message.created", (evt) => {
      const e = evt as MessageEvent<string>;
      if (e.lastEventId) lastEventId = e.lastEventId;
      const payload = parsePayload<CommMessageCreatedEvent>(e.data);
      if (payload) handlers.onMessageCreated?.(payload);
    });

    es.addEventListener("unread.changed", (evt) => {
      const e = evt as MessageEvent<string>;
      if (e.lastEventId) lastEventId = e.lastEventId;
      const payload = parsePayload<CommUnreadChangedEvent>(e.data);
      if (payload) handlers.onUnreadChanged?.(payload);
    });

    es.addEventListener("conversation.closed", (evt) => {
      const e = evt as MessageEvent<string>;
      if (e.lastEventId) lastEventId = e.lastEventId;
      const payload = parsePayload<CommConversationClosedEvent>(e.data);
      if (payload) handlers.onConversationClosed?.(payload);
    });

    // Conexión caída (red, daemon reiniciado, proxy): cerrar YA (cancela el
    // reintento nativo a la URL vieja, que fallaría siempre por el token de
    // un solo uso) y reconectar con un token fresco.
    es.onerror = () => {
      closeCurrent();
      scheduleReconnect();
    };
  }

  function stop(): void {
    stopped = true;
    clearReconnectTimer();
    closeCurrent();
  }

  onUnmounted(stop);

  return { connected, start: open, stop };
}
