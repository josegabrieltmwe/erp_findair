import { defineStore } from "pinia";
import { ref } from "vue";
import { http } from "@shared/anagrafiche/services/http";
import { runActions } from "../services/actions";
import type { ChatBubble, ChatMessage, CopilotChatResponse } from "../types";

/**
 * Conversation state for the Copilot. Keeps the rendered transcript (bubbles)
 * and the canonical history (user/assistant) sent back to the backend so the
 * server-side tool loop has context. History is session-only (not persisted).
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

  async function send(message: string): Promise<void> {
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

    const currentRoute =
      typeof window !== "undefined" ? window.location.pathname : undefined;

    try {
      const res = await http<CopilotChatResponse>("/copilot_chat", {
        method: "POST",
        body: {
          message: text,
          history: history.value,
          context: currentRoute ? { current_route: currentRoute } : {},
        },
      });

      const bubble = bubbles.value.find((b) => b.id === pendingId);
      if (bubble) {
        bubble.pending = false;
        bubble.text = res.answer;
        bubble.toolsUsed = res.tools_used?.length ? res.tools_used : undefined;
      }

      lastProvider.value = res.provider || "";

      // Keep canonical history compact (user + final assistant text).
      history.value.push({ role: "user", content: text });
      history.value.push({ role: "assistant", content: res.answer });

      // Materialize any UI actions the backend emitted (navigation/filters).
      if (res.actions?.length) {
        runActions(res.actions);
      }
    } catch (e) {
      const bubble = bubbles.value.find((b) => b.id === pendingId);
      if (bubble) {
        bubble.pending = false;
        bubble.error = true;
        bubble.text = e instanceof Error ? e.message : "Error";
      }
    } finally {
      sending.value = false;
    }
  }

  return { bubbles, history, sending, lastProvider, send, reset };
});
