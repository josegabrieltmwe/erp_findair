/**
 * Sondeo de `api_communication_poll` en vez de EventSource/SSE contra el daemon de comunicación.
 *
 * Motivo (collaudo 16/11, N57): cada conexión SSE retenía un proceso worker entero de Apache
 * (mpm_prefork) mientras la pestaña estuviera abierta; con varias pestañas de chat abiertas se
 * agotaba `MaxRequestWorkers` y el servidor respondía 503 a peticiones sin relación con el chat.
 * `api_communication_poll` es un GET corto, normal, con la sesión/Bearer de siempre: no retiene
 * ningún worker más tiempo que cualquier otra petición del API.
 *
 * El cursor (`since`) viaja de sondeo en sondeo, igual que `last_event_id` hacía en el SSE.
 * `reset: true` en la respuesta significa que el cursor ya no se puede reproducir (purgado o
 * nunca existió): se olvida y se dispara un refresco completo (`poll`) una vez, igual que el
 * `resync` que el SSE emitía tras un `event: reconnect {reset:true}`.
 */
import { onUnmounted, ref } from "vue";

import { communicationService } from "../services/communication.service";
import type {
  CommConversationClosedEvent,
  CommMessageCreatedEvent,
  CommUnreadChangedEvent,
  PollEvent,
} from "../types";

export interface CommStreamHandlers {
  onMessageCreated?: (event: CommMessageCreatedEvent) => void;
  onUnreadChanged?: (event: CommUnreadChangedEvent) => void;
  onConversationClosed?: (event: CommConversationClosedEvent) => void;
  /** Red de seguridad: refresco completo cada POLL_FALLBACK_MS, y también tras un `reset`. */
  poll?: () => unknown;
}

/** Cadencia del sondeo de eventos — suficientemente rápida para un chat humano, sin abrir nada largo. */
const POLL_INTERVAL_MS = 4000;
/** Cadencia del refresco completo de respaldo (antes: único sondeo cuando no había SSE). */
export const POLL_FALLBACK_MS = 30000;

function hidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function dispatch(handlers: CommStreamHandlers, e: PollEvent): void {
  switch (e.event) {
    case "message.created":
      handlers.onMessageCreated?.(e.data as CommMessageCreatedEvent);
      break;
    case "unread.changed":
      handlers.onUnreadChanged?.(e.data as CommUnreadChangedEvent);
      break;
    case "conversation.closed":
      handlers.onConversationClosed?.(e.data as CommConversationClosedEvent);
      break;
    default:
    // Tipo desconocido (p. ej. uno nuevo del contrato que este cliente aún no entiende): se
    // ignora, igual que un frame SSE sin listener no rompía el stream.
  }
}

export function useCommStream(handlers: CommStreamHandlers) {
  const connected = ref(false);
  /** Siempre true: el sondeo no depende de ninguna configuración del servidor (a diferencia del SSE con 501). */
  const realtimeAvailable = ref(true);

  let cursor: number | undefined;
  let stopped = true;
  let inFlight = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let safetyTimer: ReturnType<typeof setInterval> | null = null;

  function schedule(delayMs: number): void {
    if (stopped) return;
    if (pollTimer !== null) clearTimeout(pollTimer);
    pollTimer = setTimeout(() => void tick(), delayMs);
  }

  async function tick(): Promise<void> {
    pollTimer = null;
    if (stopped || inFlight) return;
    if (hidden()) {
      schedule(POLL_INTERVAL_MS);
      return;
    }
    inFlight = true;
    try {
      const res = await communicationService.pollEvents(cursor);
      connected.value = true;
      if (res.reset) {
        cursor = res.cursor;
        void Promise.resolve(handlers.poll?.()).catch(() => {});
      } else {
        for (const e of res.events) dispatch(handlers, e);
        cursor = res.cursor;
      }
    } catch {
      // Fallo pasajero (red, 5xx): no es distinto de cualquier otra petición del API que falle;
      // el siguiente sondeo ya lo intenta de nuevo, sin backoff — no hay tormenta de reconexión
      // que evitar, es una sola petición corta cada vez.
      connected.value = false;
    } finally {
      inFlight = false;
      schedule(POLL_INTERVAL_MS);
    }
  }

  function start(): Promise<void> {
    stopped = false;
    if (safetyTimer === null) {
      safetyTimer = setInterval(() => {
        if (hidden()) return;
        void Promise.resolve(handlers.poll?.()).catch(() => {});
      }, POLL_FALLBACK_MS);
    }
    return tick();
  }

  function stop(): void {
    stopped = true;
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    if (safetyTimer !== null) {
      clearInterval(safetyTimer);
      safetyTimer = null;
    }
    connected.value = false;
  }

  onUnmounted(stop);

  return { connected, realtimeAvailable, start, stop };
}
