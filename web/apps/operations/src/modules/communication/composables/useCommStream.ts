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
 *
 * Sin tiempo real en el servidor (`communication.realtime.public_url` sin configurar, el token responde 501
 * COMM_NOT_IMPLEMENTED) no se reintenta: no es una caída y no se va a arreglar sola. Se pasa a `poll` cada
 * POLL_FALLBACK_MS con la pestaña visible, para que lleguen mensajes y no leídos igualmente.
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
  /** Refresco silencioso cuando el servidor no tiene tiempo real (501). Sin él solo se deja de reintentar. */
  poll?: () => unknown;
}

const INITIAL_RECONNECT_MS = 2000;
const MAX_RECONNECT_MS = 30000;
export const POLL_FALLBACK_MS = 30000;

/** ¿El servidor dice que el tiempo real no existe (501), en vez de un fallo pasajero? */
export function isRealtimeUnavailable(e: unknown): boolean {
  // Por el estado, no por la clase: el http de @shared/anagrafiche tiene su propio ApiError.
  return typeof e === "object" && e !== null && (e as { status?: unknown }).status === 501;
}

export function useCommStream(handlers: CommStreamHandlers) {
  const connected = ref(false);
  /** false cuando el servidor no tiene tiempo real: la página funciona con `poll`. */
  const realtimeAvailable = ref(true);

  let source: EventSource | null = null;
  let lastEventId: string | null = null;
  let reconnectDelay = INITIAL_RECONNECT_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function startPolling(): void {
    if (pollTimer !== null || !handlers.poll) return;
    pollTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        void Promise.resolve(handlers.poll?.()).catch(() => {});
      } catch {
        // un refresco fallido no para el siguiente
      }
    }, POLL_FALLBACK_MS);
  }

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
    } catch (e) {
      if (isRealtimeUnavailable(e)) {
        realtimeAvailable.value = false;
        startPolling();
        return;
      }
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
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    closeCurrent();
  }

  onUnmounted(stop);

  return { connected, realtimeAvailable, start: open, stop };
}
