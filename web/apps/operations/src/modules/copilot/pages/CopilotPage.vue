<template>
  <!-- Content sits inside DashboardShell's <main>; the topbar/sidebar are the
       shared ERP chrome, so this page only renders the chat column. -->
  <div class="copilot-page">
    <div class="copilot-col">
      <!-- Transcript -->
      <div ref="scrollEl" class="copilot-transcript">
        <div v-if="store.bubbles.length === 0" class="empty">
          <v-icon
            icon="mdi-robot-happy-outline"
            size="48"
            color="primary"
            class="mb-3"
          />
          <div class="text-h6">{{ t("copilot.chat.empty_title") }}</div>
          <div class="text-body-2 text-medium-emphasis mb-5">
            {{ t("copilot.chat.empty_hint") }}
          </div>

          <div class="suggestions">
            <v-chip
              v-for="s in suggestions"
              :key="s"
              variant="outlined"
              class="ma-1"
              @click="onSend(s)"
            >
              {{ s }}
            </v-chip>
          </div>
        </div>

        <ChatBubble v-for="b in store.bubbles" :key="b.id" :bubble="b" />
      </div>

      <!-- Toolbar row: voice agent toggle + provider chip + clear -->
      <div class="copilot-meta">
        <v-btn
          :color="voiceAgentColor"
          :variant="voiceAgent.state.value === 'connected' ? 'flat' : 'tonal'"
          size="small"
          :prepend-icon="voiceAgentIcon"
          :loading="
            voiceAgent.state.value === 'requesting_permission' ||
            voiceAgent.state.value === 'connecting'
          "
          @click="voiceAgent.toggle()"
        >
          {{ voiceAgentLabel }}
        </v-btn>
        <span v-if="voiceAgent.state.value === 'error'" class="text-caption text-error ml-2">
          {{
            voiceAgent.errorMessage.value === "unsupported_browser"
              ? t("copilot.voice_agent.unsupported")
              : voiceAgent.errorMessage.value
          }}
        </span>
        <v-spacer />
        <v-chip v-if="store.lastProvider" size="x-small" variant="tonal">
          {{ store.lastProvider }}
        </v-chip>
        <v-btn
          v-if="store.bubbles.length"
          variant="text"
          size="small"
          prepend-icon="mdi-broom"
          :disabled="store.sending"
          @click="store.reset()"
        >
          {{ t("copilot.chat.clear") }}
        </v-btn>
      </div>

      <!-- Composer -->
      <ChatComposer
        :disabled="store.sending"
        :voice-supported="voice.sttSupported.value"
        :listening="voice.listening.value"
        @send="onSend"
        @mic="onMic"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useChatStore } from "../stores/chat.store";
import { useVoice } from "../composables/useVoice";
import { useCopilotVoiceAgent } from "../composables/useCopilotVoiceAgent";
import ChatBubble from "../components/ChatBubble.vue";
import ChatComposer from "../components/ChatComposer.vue";

const { t, locale } = useI18n();
const store = useChatStore();
const scrollEl = ref<HTMLElement | null>(null);
const voice = useVoice(locale.value);
const voiceAgent = useCopilotVoiceAgent();

const voiceTurn = ref(false);

// "ERP Assistant" (ElevenLabs, conversacion de voz en vivo con webhook
// tools del servidor) -- distinto del boton de microfono del composer, que
// solo dicta una frase para enviarla como mensaje de texto.
const voiceAgentLabel = computed(() => {
  switch (voiceAgent.state.value) {
    case "connected":
      return voiceAgent.mode.value === "speaking"
        ? t("copilot.voice_agent.speaking")
        : t("copilot.voice_agent.listening");
    case "requesting_permission":
      return t("copilot.voice_agent.requesting_permission");
    case "connecting":
      return t("copilot.voice_agent.connecting");
    case "error":
      return t("copilot.voice_agent.error");
    default:
      return t("copilot.voice_agent.idle");
  }
});
const voiceAgentIcon = computed(() =>
  voiceAgent.state.value === "connected" ? "mdi-phone-hangup" : "mdi-headset",
);
const voiceAgentColor = computed(() => {
  switch (voiceAgent.state.value) {
    case "connected":
      return "success";
    case "error":
      return "error";
    default:
      return undefined;
  }
});

let voiceAgentTranscriptCursor = 0;
watch(
  () => voiceAgent.transcript.value.length,
  (len) => {
    for (; voiceAgentTranscriptCursor < len; voiceAgentTranscriptCursor++) {
      const entry = voiceAgent.transcript.value[voiceAgentTranscriptCursor];
      store.bubbles.push({
        // Rango reservado alto para no colisionar con los ids numéricos
        // correlativos del store (mensajes de texto, 1..N).
        id: 1_000_000_000 + voiceAgentTranscriptCursor,
        role: entry.role === "agent" ? "assistant" : "user",
        text: entry.text,
      });
    }
  },
);
watch(
  () => voiceAgent.state.value,
  (now) => {
    if (now === "idle") voiceAgentTranscriptCursor = 0;
  },
);

const suggestions = computed(() => [
  t("copilot.suggestions.today"),
  t("copilot.suggestions.week"),
  t("copilot.suggestions.track"),
  t("copilot.suggestions.contact"),
]);

async function onSend(message: string): Promise<void> {
  voiceTurn.value = false;
  await store.send(message);
}

async function onMic(): Promise<void> {
  if (voice.listening.value) {
    voice.stopListening();
    return;
  }
  voice.stopSpeaking();
  const transcript = await voice.listen();
  if (transcript.trim()) {
    voiceTurn.value = true;
    await store.send(transcript);
  }
}

watch(
  () => store.sending,
  (now, prev) => {
    if (prev && !now && voiceTurn.value) {
      const last = store.bubbles[store.bubbles.length - 1];
      if (last && last.role === "assistant" && !last.error) {
        void voice.speak(last.text);
      }
      voiceTurn.value = false;
    }
  },
);

watch(
  () =>
    store.bubbles.map((b) => `${b.id}:${b.pending}:${b.text.length}`).join("|"),
  async () => {
    await nextTick();
    const el = scrollEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
);
</script>

<style scoped>
.copilot-page {
  display: flex;
  justify-content: center;
  height: 100%;
}
.copilot-col {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 880px;
  height: calc(100vh - 112px); /* minus the shared two-row topbar */
}
.copilot-transcript {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 20px 16px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-top: 6vh;
}
.suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 560px;
}
.copilot-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px;
}
</style>
