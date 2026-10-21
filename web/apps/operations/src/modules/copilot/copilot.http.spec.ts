import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ApiError } from "@shared/anagrafiche/services/api.types";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));
vi.mock("./services/actions", () => ({ runActions: vi.fn() }));

import { useChatStore } from "./stores/chat.store";
import { useVoice } from "./composables/useVoice";

describe("copilot chat via http compartido", () => {
  beforeEach(() => {
    httpMock.mockReset();
    setActivePinia(createPinia());
  });

  it("envia POST a /copilot_chat con mensaje, historial y contexto", async () => {
    httpMock.mockResolvedValue({
      answer: "hola",
      provider: "openai",
      tools_used: [],
    });
    const store = useChatStore();
    await store.send("que tal");
    const [url, options] = httpMock.mock.calls[0];
    expect(url).toBe("/copilot_chat");
    expect(options.method).toBe("POST");
    expect(options.body.message).toBe("que tal");
    expect(Array.isArray(options.body.history)).toBe(true);
    expect(store.bubbles.at(-1)?.text).toBe("hola");
    expect(store.history).toHaveLength(2);
  });

  it("muestra el mensaje del ApiError en la burbuja de error", async () => {
    httpMock.mockRejectedValue(
      new ApiError("Copilot disabled", 403, "FORBIDDEN"),
    );
    const store = useChatStore();
    await store.send("x");
    const bubble = store.bubbles.at(-1);
    expect(bubble?.error).toBe(true);
    expect(bubble?.text).toBe("Copilot disabled");
    expect(store.sending).toBe(false);
  });
});

describe("useVoice.speak via http compartido", () => {
  beforeEach(() => {
    httpMock.mockReset();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: () => "blob:x",
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.stubGlobal(
      "Audio",
      class {
        onended: (() => void) | null = null;
        play = () => Promise.resolve();
        pause = () => undefined;
      },
    );
  });

  it("pide el audio por POST /copilot_tts como blob", async () => {
    httpMock.mockResolvedValue(new Blob(["mp3"]));
    const voice = useVoice("es");
    await voice.speak("hola");
    const [url, options] = httpMock.mock.calls[0];
    expect(url).toBe("/copilot_tts");
    expect(options).toEqual({
      method: "POST",
      body: { text: "hola" },
      responseType: "blob",
    });
    expect(voice.speaking.value).toBe(true);
  });

  it("es silencioso si la peticion falla", async () => {
    httpMock.mockRejectedValue(new ApiError("Server error", 500));
    const voice = useVoice("es");
    await expect(voice.speak("hola")).resolves.toBeUndefined();
    expect(voice.speaking.value).toBe(false);
  });

  it("no llama a la red con texto vacio", async () => {
    const voice = useVoice("es");
    await voice.speak("   ");
    expect(httpMock).not.toHaveBeenCalled();
  });
});
