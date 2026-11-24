import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({
  http: (...args: unknown[]) => httpMock(...args),
}));

const extractShipmentMock = vi.fn();
const { FakeAiExtractError } = vi.hoisted(() => ({
  FakeAiExtractError: class extends Error {
    constructor(
      message: string,
      public readonly kind: string,
    ) {
      super(message);
      this.name = "AiExtractError";
    }
  },
}));
vi.mock("@shared/ai-extract/aiExtract.service", () => ({
  extractShipment: (...args: unknown[]) => extractShipmentMock(...args),
  AiExtractError: FakeAiExtractError,
}));

const fileToBase64Mock = vi.fn();
vi.mock("@tmwe/shared-frontend/files/fileToBase64", () => ({
  fileToBase64: (...args: unknown[]) => fileToBase64Mock(...args),
}));

import {
  ACCEPTED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  useChatStore,
} from "./chat.store";

function fakeFile(name: string, type: string, size: number): File {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("adjuntos del Copilot (AI Extract)", () => {
  beforeEach(() => {
    httpMock.mockReset();
    extractShipmentMock.mockReset();
    fileToBase64Mock.mockReset();
    setActivePinia(createPinia());
  });

  it("rechaza un fichero demasiado grande sin leerlo", async () => {
    const store = useChatStore();
    const result = await store.attachFile(
      fakeFile("grande.pdf", "application/pdf", MAX_ATTACHMENT_BYTES + 1),
    );
    expect(result).toBe("too_large");
    expect(store.pendingAttachment).toBeNull();
    expect(fileToBase64Mock).not.toHaveBeenCalled();
  });

  it("rechaza un tipo no soportado sin leerlo", async () => {
    const store = useChatStore();
    const result = await store.attachFile(
      fakeFile("hoja.xlsx", "application/vnd.ms-excel", 1000),
    );
    expect(result).toBe("unsupported_type");
    expect(fileToBase64Mock).not.toHaveBeenCalled();
  });

  it("acepta cualquiera de los tipos declarados", async () => {
    fileToBase64Mock.mockResolvedValue("QQ==");
    const store = useChatStore();
    for (const mime of ACCEPTED_ATTACHMENT_MIME_TYPES) {
      const result = await store.attachFile(fakeFile("f", mime, 100));
      expect(result).toBeNull();
      expect(store.pendingAttachment?.mimeType).toBe(mime);
    }
  });

  it("guarda el adjunto pendiente leído (nombre, mime, base64, tamaño)", async () => {
    fileToBase64Mock.mockResolvedValueOnce("QQ==");
    const store = useChatStore();
    const result = await store.attachFile(
      fakeFile("f.pdf", "application/pdf", 100),
    );
    expect(result).toBeNull();
    expect(store.pendingAttachment).toEqual({
      filename: "f.pdf",
      mimeType: "application/pdf",
      base64: "QQ==",
      sizeBytes: 100,
    });
  });

  it("clearAttachment limpia el adjunto pendiente", async () => {
    fileToBase64Mock.mockResolvedValueOnce("QQ==");
    const store = useChatStore();
    await store.attachFile(fakeFile("f.pdf", "application/pdf", 100));
    expect(store.pendingAttachment).not.toBeNull();
    store.clearAttachment();
    expect(store.pendingAttachment).toBeNull();
  });

  it("sendWithAttachment: extrae, resume y manda el resumen como mensaje de copilot_chat", async () => {
    fileToBase64Mock.mockResolvedValueOnce("QQ==");
    extractShipmentMock.mockResolvedValueOnce({
      extracted: { destination: { city: "Milano" } },
      warnings: [],
      missingFields: [],
    });
    httpMock.mockResolvedValueOnce({
      answer: "Preparado.",
      actions: [],
      proposals: [],
      provider: "openai",
      tools_used: [],
    });

    const store = useChatStore();
    await store.attachFile(fakeFile("factura.pdf", "application/pdf", 100));
    await store.sendWithAttachment("aquí va esto");

    expect(store.pendingAttachment).toBeNull();
    const userBubble = store.bubbles[0];
    expect(userBubble.text).toBe("aquí va esto");
    expect(userBubble.attachment).toEqual({
      filename: "factura.pdf",
      mimeType: "application/pdf",
    });

    const [, httpOptions] = httpMock.mock.calls[0];
    expect(httpOptions.body.message).toContain("aquí va esto");
    expect(httpOptions.body.message).toContain("- destination.city: Milano");

    const [extractArgs] = extractShipmentMock.mock.calls[0];
    expect(extractArgs.file).toEqual({
      content: "QQ==",
      mimeType: "application/pdf",
      filename: "factura.pdf",
    });

    expect(store.bubbles.at(-1)?.text).toBe("Preparado.");
    expect(store.sending).toBe(false);
  });

  it("sendWithAttachment sin leyenda: la burbuja del usuario queda vacía pero el adjunto se ve en el chip", async () => {
    fileToBase64Mock.mockResolvedValueOnce("QQ==");
    extractShipmentMock.mockResolvedValueOnce({
      extracted: { x: "y" },
      warnings: [],
      missingFields: [],
    });
    httpMock.mockResolvedValueOnce({
      answer: "ok",
      actions: [],
      proposals: [],
      provider: "x",
      tools_used: [],
    });

    const store = useChatStore();
    await store.attachFile(fakeFile("f.png", "image/png", 100));
    await store.sendWithAttachment("");

    expect(store.bubbles[0].text).toBe("");
    expect(store.bubbles[0].attachment?.filename).toBe("f.png");
    expect(httpMock.mock.calls[0][1].body.message).toContain("- x: y");
  });

  it("si la extracción falla (presupuesto agotado), la burbuja queda en error y no se llama a copilot_chat", async () => {
    fileToBase64Mock.mockResolvedValueOnce("QQ==");
    extractShipmentMock.mockRejectedValueOnce(
      new FakeAiExtractError("sin presupuesto", "budget_exhausted"),
    );

    const store = useChatStore();
    await store.attachFile(fakeFile("f.pdf", "application/pdf", 100));
    await store.sendWithAttachment("");

    expect(httpMock).not.toHaveBeenCalled();
    const bubble = store.bubbles.at(-1)!;
    expect(bubble.error).toBe(true);
    expect(bubble.errorKey).toBe("copilot.errors.ai_budget");
    expect(store.sending).toBe(false);
  });

  it("sin adjunto pendiente, sendWithAttachment no hace nada", async () => {
    const store = useChatStore();
    await store.sendWithAttachment("hola");
    expect(httpMock).not.toHaveBeenCalled();
    expect(extractShipmentMock).not.toHaveBeenCalled();
    expect(store.bubbles).toHaveLength(0);
  });
});
