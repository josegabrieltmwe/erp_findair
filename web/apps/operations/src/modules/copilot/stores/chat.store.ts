import { defineStore } from "pinia";
import { ref } from "vue";
import { http } from "@shared/anagrafiche/services/http";
import { runActions, type ActionRouter } from "../services/actions";
import {
  backendCode,
  classifyConfirmError,
  confirmProposal,
  interpretConfirmResponse,
  newView,
  parseProposal,
  remainingSeconds,
} from "../services/proposal";
import type { ChatBubble, ChatMessage, CopilotChatResponse } from "../types";

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

/** Known chat failures that deserve a specific message (BFF limits, kill-switch). */
function chatErrorKey(e: unknown): string | undefined {
  const status = (e as { status?: unknown })?.status;
  switch (backendCode(e)) {
    case "concurrency_limited":
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

  let nextId = 1;

  function reset(): void {
    bubbles.value = [];
    history.value = [];
    lastProvider.value = "";
    nextId = 1;
  }

  async function send(message: string, ctx: SendContext = {}): Promise<void> {
    const text = message.trim();
    if (text === "" || sending.value) return;

    // User bubble
    bubbles.value.push({ id: nextId++, role: "user", text });

    // Pending assistant bubble
    const pendingId = nextId++;
    bubbles.value.push({
      id: pendingId,
      role: "assistant",
      text: "",
      pending: true,
    });

    sending.value = true;

    const context: Record<string, string> = {};
    const locale = normalizeLocale(ctx.locale);
    if (locale) context.locale = locale;
    if (ctx.currentRoute) context.current_route = ctx.currentRoute;

    try {
      const res = await http<CopilotChatResponse>("/copilot_chat", {
        method: "POST",
        body: { message: text, history: history.value, context },
      });

      const bubble = bubbles.value.find((b) => b.id === pendingId);
      if (bubble) {
        bubble.pending = false;
        // Plain text only: rendered with textContent (v-text), never as HTML/markdown.
        bubble.text = typeof res.answer === "string" ? res.answer : "";
        bubble.toolsUsed = res.tools_used?.length ? res.tools_used : undefined;

        // At most one proposal per turn; an invalid one is dropped (no card from partial data).
        const proposal = parseProposal(res.proposals?.[0]);
        if (proposal) bubble.proposal = newView(proposal, Date.now());
      }

      lastProvider.value = res.provider || "";

      // Keep canonical history compact (user + final assistant text).
      history.value.push({ role: "user", content: text });
      history.value.push({ role: "assistant", content: bubble?.text ?? "" });

      // Materialize any UI actions the backend emitted (navigation by SPA route name).
      if (res.actions?.length && ctx.router) {
        runActions(res.actions, ctx.router);
      }
    } catch (e) {
      const bubble = bubbles.value.find((b) => b.id === pendingId);
      if (bubble) {
        bubble.pending = false;
        bubble.error = true;
        bubble.errorKey = chatErrorKey(e);
        bubble.text = e instanceof Error ? e.message : "Error";
      }
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
    send,
    reset,
    confirm,
    dismiss,
  };
});
