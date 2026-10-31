/**
 * Agente de voz ElevenLabs ("ERP Assistant", perfil copilot_operator) del
 * Copilot interno -- distinto de useVoice.ts (dictado STT/TTS del propio
 * navegador para el chat de texto). Este es una conversacion en vivo con el
 * agente real: webhook tools del lado del servidor (tracking, rubrica,
 * tarifas, propuestas de envio...), no clientTools locales -- a diferencia
 * del ConversationController del plugin WordPress (public_form, que rellena
 * un formulario en pantalla), aqui no hace falta tool-registry ni
 * FormBridge: las 11 tools del perfil son todas webhook tools resueltas por
 * ElevenLabs llamando de vuelta al ERP con el Bearer `user_token`
 * (ver docs/02-arquitectura/agentes-ia/09-seguridad-agentes-propios-de-partner.md y Elevenlabs_Tools_Definition.php en el backend).
 *
 * dynamicVariables obligatorias (Elevenlabs_Partner_Agent_Verifier::
 * SESSION_VARIABLES en el backend): sin apertura/partner, ElevenLabs
 * rechaza la sesion ANTES de conectar -- api_copilot_elevenlabs_credential
 * ya las devuelve todas en una sola respuesta.
 */
import { ref, shallowRef } from "vue";
import { Conversation, type Conversation as ConversationInstance } from "@elevenlabs/client";
import { http } from "@shared/anagrafiche/services/http";

export type VoiceAgentState =
  | "idle"
  | "requesting_permission"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

interface CopilotCredentialResponse {
  success: boolean;
  signed_url: string | null;
  conversation_token: string | null;
  agent_profile: string;
  agent_token: { token: string; expires_in: number } | null;
  language: string;
  contesto: string;
  apertura: string;
  operador: number;
  agente: string;
  partner: string;
  session_binding?: { sig: string; exp: number; nonce: string } | null;
}

export interface VoiceAgentTranscriptEntry {
  role: "user" | "agent";
  text: string;
}

/**
 * ¿El navegador soporta lo minimo para una conversacion de voz? Mismo
 * chequeo que conversation-controller.ts del plugin WordPress.
 */
export function isVoiceAgentSupported(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return true;
  }
  const hasGetUserMedia = !!(
    navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function"
  );
  const hasAudioContext =
    typeof (window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext) !==
    "undefined";
  return hasGetUserMedia && hasAudioContext;
}

export function useCopilotVoiceAgent() {
  const state = ref<VoiceAgentState>("idle");
  const mode = ref<"speaking" | "listening" | null>(null);
  const errorMessage = ref<string | null>(null);
  const transcript = ref<VoiceAgentTranscriptEntry[]>([]);

  let conversation: ConversationInstance | null = null;
  // Cadena serial: start()/stop() nunca se solapan (mismo criterio que
  // ConversationController del plugin WordPress).
  let chain: Promise<void> = Promise.resolve();

  function enqueue(op: () => Promise<void>): Promise<void> {
    const run = chain.then(op);
    chain = run.catch(() => undefined);
    return run;
  }

  async function teardown(): Promise<void> {
    const prev = conversation;
    conversation = null;
    if (prev) {
      try {
        await prev.endSession();
      } catch {
        // ignorado: el SDK ya pudo haber cerrado la sesion por su cuenta.
      }
    }
  }

  async function requestCredential(): Promise<CopilotCredentialResponse> {
    return http<CopilotCredentialResponse>("/api_copilot_elevenlabs_credential", {
      method: "POST",
      body: { transport: "websocket" },
    });
  }

  async function doStart(): Promise<void> {
    if (state.value === "connected" && conversation) return;
    await teardown();

    if (!isVoiceAgentSupported()) {
      state.value = "error";
      errorMessage.value = "unsupported_browser";
      return;
    }

    state.value = "requesting_permission";
    transcript.value = [];

    let cred: CopilotCredentialResponse;
    try {
      cred = await requestCredential();
    } catch (e) {
      state.value = "error";
      errorMessage.value = e instanceof Error ? e.message : "No se pudo obtener la credencial de voz.";
      return;
    }

    if (!cred.success || !cred.signed_url) {
      state.value = "error";
      errorMessage.value = "El asistente de voz no esta disponible ahora mismo.";
      return;
    }

    state.value = "connecting";

    try {
      conversation = await Conversation.startSession({
        signedUrl: cred.signed_url,
        dynamicVariables: {
          // user_token: el Bearer con el que las webhook tools actuan en
          // nombre del usuario (nombre literal exigido por ElevenLabs, ver
          // docblock de Elevenlabs_Conversation_Credential_Controller en el
          // backend). agent_token ya viene acotado por ruta -- nunca el
          // access token completo de la sesion.
          user_token: cred.agent_token?.token ?? "",
          contesto: cred.contesto,
          operador: String(cred.operador),
          agente: cred.agente,
          apertura: cred.apertura,
          partner: cred.partner,
          current_language: cred.language,
          ...(cred.session_binding
            ? {
                session_sig: cred.session_binding.sig,
                session_exp: String(cred.session_binding.exp),
                session_nonce: cred.session_binding.nonce,
              }
            : {}),
        },
        onConnect: () => {
          state.value = "connected";
        },
        onDisconnect: () => {
          conversation = null;
          state.value = "idle";
          mode.value = null;
        },
        onError: (message: string) => {
          state.value = "error";
          errorMessage.value = message;
        },
        onModeChange: (prop: { mode: "speaking" | "listening" }) => {
          mode.value = prop.mode;
        },
        onMessage: (props: { message: string; role: "user" | "agent" }) => {
          transcript.value.push({ role: props.role, text: props.message });
        },
      });
    } catch (e) {
      conversation = null;
      state.value = "error";
      errorMessage.value = e instanceof Error ? e.message : "No se pudo iniciar la conversacion.";
    }
  }

  async function doStop(): Promise<void> {
    await teardown();
    state.value = "idle";
    mode.value = null;
  }

  function start(): Promise<void> {
    return enqueue(doStart);
  }

  function stop(): Promise<void> {
    return enqueue(doStop);
  }

  function toggle(): Promise<void> {
    return state.value === "idle" || state.value === "error" ? start() : stop();
  }

  return {
    state,
    mode,
    errorMessage,
    transcript,
    start,
    stop,
    toggle,
  };
}
