/**
 * Voice I/O for the Copilot — transport only; the reasoning stays in the own
 * multi-provider brain (copilot_chat).
 *
 *  - STT (input): browser Web Speech API. Free, no provider lock-in. Falls back
 *    to "unsupported" on browsers without it (Firefox/Safari may lack it).
 *  - TTS (output): ElevenLabs via the ERP proxy (copilot_tts) — the API key
 *    never reaches the browser; we just fetch and play the returned MP3.
 */
import { ref } from "vue";
import { http } from "@shared/anagrafiche/services/http";

// Minimal typing for the non-standard SpeechRecognition API.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice(localeIso2: string) {
  const sttSupported = ref(getRecognitionCtor() !== null);
  const listening = ref(false);
  const speaking = ref(false);

  let recognition: SpeechRecognitionLike | null = null;
  let currentAudio: HTMLAudioElement | null = null;

  const langMap: Record<string, string> = {
    es: "es-ES",
    it: "it-IT",
    en: "en-US",
  };

  /** Start listening; resolves with the recognized transcript (or '' if none). */
  function listen(): Promise<string> {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return Promise.resolve("");

    return new Promise((resolve) => {
      recognition = new Ctor();
      recognition.lang = langMap[localeIso2] ?? "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      let result = "";
      recognition.onresult = (e) => {
        const last = e.results[e.results.length - 1];
        result = last?.[0]?.transcript ?? "";
      };
      recognition.onerror = () => {
        listening.value = false;
        resolve("");
      };
      recognition.onend = () => {
        listening.value = false;
        resolve(result);
      };

      listening.value = true;
      recognition.start();
    });
  }

  function stopListening(): void {
    if (recognition && listening.value) {
      recognition.stop();
    }
  }

  /** Synthesize and play text via the ERP TTS proxy. Best-effort (silent on fail). */
  async function speak(text: string): Promise<void> {
    if (!text.trim()) return;
    stopSpeaking();
    try {
      const blob = await http<Blob, "blob">("/copilot_tts", {
        method: "POST",
        body: { text },
        responseType: "blob",
      });
      const url = URL.createObjectURL(blob);
      currentAudio = new Audio(url);
      speaking.value = true;
      currentAudio.onended = () => {
        speaking.value = false;
        URL.revokeObjectURL(url);
      };
      await currentAudio.play();
    } catch {
      speaking.value = false;
    }
  }

  function stopSpeaking(): void {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    speaking.value = false;
  }

  return {
    sttSupported,
    listening,
    speaking,
    listen,
    stopListening,
    speak,
    stopSpeaking,
  };
}
