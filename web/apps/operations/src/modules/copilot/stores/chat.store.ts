import { defineStore } from "pinia";
import { ref } from "vue";
import { http } from "@shared/anagrafiche/services/http";
import {
  AiExtractError,
  extractShipment,
} from "@shared/ai-extract/aiExtract.service";
import { fileToBase64 } from "@tmwe/shared-frontend/files/fileToBase64";
import { runActions, type ActionRouter } from "../services/actions";
import { summarizeExtraction } from "../services/attachmentSummary";
import {
  backendCode,
  classifyConfirmError,
  confirmProposal,
  interpretConfirmResponse,
  newView,
  parseProposal,
  remainingSeconds,
} from "../services/proposal";
import type {
  AttachError,
  ChatBubble,
  ChatMessage,
  CopilotChatResponse,
  PendingAttachment,
} from "../types";

/** Igual que el límite del backend (D-C5, docs/plan-extraccion-ia-erp.md), antes de codificar a base64. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Lo que `api_ai_extract` acepta hoy (tmwe_api/docs/03-diseno/extraccion_ia_formatos/PLAN.md:22); xlsx/ods/odt
 * están fuera de alcance mientras ese plan de backend no se ejecute. */
export const ACCEPTED_ATTACHMENT_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

/** Languages the backend accepts in `context.locale`. */
const LOCALES = ["es", "it", "en", "de", "nl"] as const;

/** vue-i18n locale ("es", "it-IT"…) -> one of the five supported, or undefined. */
export function normalizeLocale(raw: string | undefined): string | undefined {
  const short = (raw ?? "").slice(0, 2).toLowerCase();
  return (LOCALES as readonly string[]).includes(short) ? short : undefined;
}

/** Context the page knows and the store does not (keeps the store free of router/i18n singletons). */
export interface SendContext {
  /** UI language (vue-i18n). */
  locale?: string;
  /** SPA route path (e.g. "/shipment/list"), without query string. */
  currentRoute?: string;
  /** Router used to materialize `actions[]` by route name. */
  router?: ActionRouter;
}

/**
 * Conversación procesada por el demonio del API (PLAN_MIGRACION_RPC_DEMONIO.md R2): el POST con `async: true`
 * responde 202 {request_id} y el resultado (la misma respuesta que el POST síncrono) se consulta en
 * /copilot_chat_state. Sin demonio el servidor responde en síncrono y no hay nada que esperar.
 */
export const COPILOT_ASYNC = {
  maxDurationMs: 8 * 60_000,
  defaultPollMs: 1000,
  minPollMs: 300,
};

interface CopilotChatQueued {
  status: "waiting";
  request_id: number;
  poll_after_ms?: number;
}

interface CopilotChatState {
  status: string;
  request_id: number;
  cursor?: number;
  result?: CopilotChatResponse;
  error?: { code?: string; message?: string };
  poll_after_ms?: number;
}

/** Error de una conversación asíncrona, con el código del backend donde lo busca backendCode(). */
class CopilotAsyncError extends Error {
  details: { code: string };
  constructor(code: string, message: string) {
    super(message);
    this.details = { code };
  }
}

function isQueued(res: unknown): res is CopilotChatQueued {
  const r = res as Partial<CopilotChatQueued> | null;
  return !!r && r.status === "waiting" && typeof r.request_id === "number";
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Espera el resultado de una conversación encargada con async:true. */
export async function awaitCopilotChat(
  queued: CopilotChatQueued,
): Promise<CopilotChatResponse> {
  const started = Date.now();
  let wait = queued.poll_after_ms ?? COPILOT_ASYNC.defaultPollMs;
  while (Date.now() - started < COPILOT_ASYNC.maxDurationMs) {
    await sleep(Math.max(COPILOT_ASYNC.minPollMs, wait));
    const st = await http<CopilotChatState>("/copilot_chat_state", {
      method: "GET",
      query: { request_id: queued.request_id },
    });
    if (st.status === "done" && st.result) return st.result;
    if (st.status !== "running") {
      throw new CopilotAsyncError(
        st.error?.code ?? "AI_TIMEOUT",
        st.error?.message ?? "The assistant did not answer",
      );
    }
    wait = st.poll_after_ms ?? COPILOT_ASYNC.defaultPollMs;
  }
  throw new CopilotAsyncError(
    "AI_TIMEOUT",
    "The assistant did not answer in time",
  );
}

/** Known chat failures that deserve a specific message (BFF limits, kill-switch). */
function chatErrorKey(e: unknown): string | undefined {
  const status = (e as { status?: unknown })?.status;
  switch (backendCode(e)) {
    case "concurrency_limited":
    case "copilot_busy":
      return "copilot.errors.busy";
    case "rate_limited":
      return "copilot.errors.rate_limited";
    case "capacity_exceeded":
    case "throttle_unavailable":
      return "copilot.errors.unavailable";
    case "ai_forbidden":
      return "copilot.errors.disabled";
    // tmwe_json AI_* codes, kept by the BFF on copilot routes (lower-cased by backendCode).
    case "ai_credentials_missing":
    case "ai_credentials_invalid":
      return "copilot.errors.ai_not_configured";
    case "ai_unavailable":
    case "ai_timeout":
    case "ai_provider_error":
    case "ai_protocol_unsupported":
    case "ai_bad_request":
      return "copilot.errors.ai_unavailable";
    case "ai_budget_exceeded":
      return "copilot.errors.ai_budget";
    default:
      return status === 429 ? "copilot.errors.rate_limited" : undefined;
  }
}

/** Mismo propósito que chatErrorKey, para errores de AiExtractError (adjunto del chat). */
function extractErrorKey(e: unknown): string {
  if (e instanceof AiExtractError) {
    switch (e.kind) {
      case "budget_exhausted":
        return "copilot.errors.ai_budget";
      case "no_data":
        return "copilot.errors.extract_no_data";
      case "unavailable":
      default:
        return "copilot.errors.ai_unavailable";
    }
  }
  return "copilot.errors.ai_unavailable";
}

/**
 * Conversation state for the Copilot. Keeps the rendered transcript (bubbles)
 * and the canonical history (user/assistant) sent back to the backend so the
 * server-side tool loop has context. History is session-only (not persisted)
 * and only ever holds plain user/assistant text (the server re-sanitizes it).
 */
export const useChatStore = defineStore("copilotChat", () => {
  const bubbles = ref<ChatBubble[]>([]);
  const history = ref<ChatMessage[]>([]);
  const sending = ref(false);
  const lastProvider = ref<string>("");
  /** Fichero leído en cliente, pendiente de mandar con el siguiente turno (AI Extract). */
  const pendingAttachment = ref<PendingAttachment | null>(null);

  let nextId = 1;

  function reset(): void {
    bubbles.value = [];
    history.value = [];
    lastProvider.value = "";
    pendingAttachment.value = null;
    nextId = 1;
  }

  /**
   * El turno de `copilot_chat` en sí (llamada + espera async + volcado en la burbuja `pendingId` ya creada).
   * `backendMessage` es lo que se manda y se guarda en `history`; puede ser distinto de lo que el usuario ve
   * en su burbuja (ver sendWithAttachment, que manda el resumen de la extracción, no la leyenda del adjunto).
   */
  async function runTurn(
    backendMessage: string,
    pendingId: number,
    ctx: SendContext,
  ): Promise<void> {
    const context: Record<string, string> = {};
    const locale = normalizeLocale(ctx.locale);
    if (locale) context.locale = locale;
    if (ctx.currentRoute) context.current_route = ctx.currentRoute;

    try {
      const first = await http<CopilotChatResponse | CopilotChatQueued>(
        "/copilot_chat",
        {
          method: "POST",
          body: {
            message: backendMessage,
            history: history.value,
            context,
            async: true,
          },
        },
      );
      const res: CopilotChatResponse = isQueued(first)
        ? await awaitCopilotChat(first)
        : first;

      const bubble = bubbles.value.find((b) => b.id === pendingId);
      if (bubble) {
        bubble.pending = false;
        bubble.pendingLabelKey = undefined;
        // Plain text only: rendered with textContent (v-text), never as HTML/markdown.
        bubble.text = typeof res.answer === "string" ? res.answer : "";
        bubble.toolsUsed = res.tools_used?.length ? res.tools_used : undefined;

        // At most one proposal per turn; an invalid one is dropped (no card from partial data).
        const proposal = parseProposal(res.proposals?.[0]);
        if (proposal) bubble.proposal = newView(proposal, Date.now());
      }

      lastProvider.value = res.provider || "";

      // Keep canonical history compact (user + final assistant text).
      history.value.push({ role: "user", content: backendMessage });
      history.value.push({ role: "assistant", content: bubble?.text ?? "" });

      // Materialize any UI actions the backend emitted (navigation by SPA route name).
      if (res.actions?.length && ctx.router) {
        runActions(res.actions, ctx.router);
      }
    } catch (e) {
      const bubble = bubbles.value.find((b) => b.id === pendingId);
      if (bubble) {
        bubble.pending = false;
        bubble.pendingLabelKey = undefined;
        bubble.error = true;
        bubble.errorKey = chatErrorKey(e);
        bubble.text = e instanceof Error ? e.message : "Error";
      }
    }
  }

  async function send(message: string, ctx: SendContext = {}): Promise<void> {
    const text = message.trim();
    if (text === "" || sending.value) return;

    bubbles.value.push({ id: nextId++, role: "user", text });
    const pendingId = nextId++;
    bubbles.value.push({
      id: pendingId,
      role: "assistant",
      text: "",
      pending: true,
    });

    sending.value = true;
    try {
      await runTurn(text, pendingId, ctx);
    } finally {
      sending.value = false;
    }
  }

  /**
   * Valida y lee un fichero adjuntado en el composer (no lo manda: solo queda en `pendingAttachment` hasta el
   * próximo `sendWithAttachment`). docs/plan-extraccion-ia-erp.md §2.3.
   */
  async function attachFile(file: File): Promise<AttachError | null> {
    if (file.size > MAX_ATTACHMENT_BYTES) return "too_large";
    if (!ACCEPTED_ATTACHMENT_MIME_TYPES.has(file.type))
      return "unsupported_type";
    const base64 = await fileToBase64(file);
    pendingAttachment.value = {
      filename: file.name,
      mimeType: file.type,
      base64,
      sizeBytes: file.size,
    };
    return null;
  }

  function clearAttachment(): void {
    pendingAttachment.value = null;
  }

  /**
   * Envía el adjunto pendiente: extrae campos (`api_ai_extract`), los resume en texto y continúa el turno de
   * chat de siempre (`runTurn`) — el Copilot ve un mensaje largo, no un contrato nuevo. `caption` es lo que el
   * usuario escribió junto al adjunto (puede ir vacío) y es lo único que se muestra en su burbuja.
   */
  async function sendWithAttachment(
    caption: string,
    ctx: SendContext = {},
  ): Promise<void> {
    const attachment = pendingAttachment.value;
    if (!attachment || sending.value) return;
    pendingAttachment.value = null;
    const displayText = caption.trim();

    bubbles.value.push({
      id: nextId++,
      role: "user",
      text: displayText,
      attachment: {
        filename: attachment.filename,
        mimeType: attachment.mimeType,
      },
    });
    const pendingId = nextId++;
    bubbles.value.push({
      id: pendingId,
      role: "assistant",
      text: "",
      pending: true,
      pendingLabelKey: "copilot.chat.extracting",
    });

    sending.value = true;
    try {
      let summary: string;
      try {
        const result = await extractShipment({
          // D-C1 (docs/plan-extraccion-ia-erp.md): valor por defecto por ahora; si es cargo, se corrige
          // hablando con el Copilot en vez de pedírselo al usuario antes de adjuntar.
          mode: "express",
          file: {
            content: attachment.base64,
            mimeType: attachment.mimeType,
            filename: attachment.filename,
          },
        });
        summary = summarizeExtraction(attachment.filename, result);
      } catch (e) {
        const bubble = bubbles.value.find((b) => b.id === pendingId);
        if (bubble) {
          bubble.pending = false;
          bubble.pendingLabelKey = undefined;
          bubble.error = true;
          bubble.errorKey = extractErrorKey(e);
          bubble.text = e instanceof Error ? e.message : "Error";
        }
        return;
      }

      const backendMessage = displayText
        ? `${displayText}\n\n${summary}`
        : summary;
      await runTurn(backendMessage, pendingId, ctx);
    } finally {
      sending.value = false;
    }
  }

  /**
   * Confirm the proposal of a bubble. Sends the received payload untouched. Only `executed:true` with
   * `readback.status === "verified"` ends in status "verified"; everything else shows the real state.
   *
   * @param acknowledged second gesture for reinforced confirmations (cancels)
   */
  async function confirm(
    bubbleId: number,
    acknowledged = false,
    now: () => number = Date.now,
  ): Promise<void> {
    const view = bubbles.value.find((b) => b.id === bubbleId)?.proposal;
    if (!view) return;
    const canRetry = view.status === "error" && view.retryable === true;
    if (view.status !== "pending" && !canRetry) return;
    if (view.proposal.reinforced_confirmation && !acknowledged) return;

    if (
      remainingSeconds(view.receivedAt, view.proposal.expires_in, now()) <= 0
    ) {
      view.status = "error";
      view.errorKind = "expired";
      view.retryable = false;
      return;
    }

    view.status = "confirming";
    view.errorKind = undefined;
    try {
      const outcome = interpretConfirmResponse(
        await confirmProposal(view.proposal),
      );
      view.status = outcome.status;
      view.retryable = false;
      view.outcome = {
        httpStatus: outcome.httpStatus,
        error: outcome.error,
        notCompared: outcome.notCompared,
        createdId: outcome.createdId,
      };
    } catch (e) {
      const c = classifyConfirmError(e);
      view.status = "error";
      view.errorKind = c.kind;
      view.retryable = c.retryable;
    }
  }

  /** Discard locally: no backend call exists to reject a proposal (it just expires unspent). */
  function dismiss(bubbleId: number): void {
    const view = bubbles.value.find((b) => b.id === bubbleId)?.proposal;
    if (view && (view.status === "pending" || view.status === "error")) {
      view.status = "dismissed";
      view.retryable = false;
    }
  }

  return {
    bubbles,
    history,
    sending,
    lastProvider,
    pendingAttachment,
    send,
    sendWithAttachment,
    attachFile,
    clearAttachment,
    reset,
    confirm,
    dismiss,
  };
});
