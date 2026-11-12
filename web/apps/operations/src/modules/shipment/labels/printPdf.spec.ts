import { describe, expect, it, vi } from "vitest";
import { printPdfFromUrl } from "./printPdf";

function res(body: BodyInit | null, init: ResponseInit & { type?: string }) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": init.type ?? "application/pdf" },
  });
}

describe("printPdfFromUrl", () => {
  it("descarga el PDF con la sesión y lo manda a imprimir desde un iframe", async () => {
    const fetchFn = vi.fn().mockResolvedValue(res("%PDF", {}));
    const print = vi.fn();
    const remove = vi.fn();
    await printPdfFromUrl("/bff/v1/x.pdf", {
      fetchFn: fetchFn as unknown as typeof fetch,
      createObjectURL: () => "blob:1",
      revokeObjectURL: () => {},
      openTab: vi.fn(),
      mountIframe: (url, onLoad) => {
        expect(url).toBe("blob:1");
        queueMicrotask(onLoad);
        return { print, remove };
      },
    });
    expect(fetchFn).toHaveBeenCalledWith("/bff/v1/x.pdf", {
      credentials: "same-origin",
    });
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("si no puede imprimir desde el iframe abre el PDF en una pestaña", async () => {
    const openTab = vi.fn();
    await printPdfFromUrl("/x", {
      fetchFn: (async () => res("%PDF", {})) as unknown as typeof fetch,
      createObjectURL: () => "blob:2",
      revokeObjectURL: () => {},
      openTab,
      mountIframe: (_u, onLoad) => {
        queueMicrotask(onLoad);
        return {
          print: () => {
            throw new Error("blocked");
          },
          remove: () => {},
        };
      },
    });
    expect(openTab).toHaveBeenCalledWith("blob:2");
  });

  it("propaga el mensaje del servidor cuando no es un PDF", async () => {
    const fetchFn = async () =>
      res(JSON.stringify({ error: { message: "Access denied" } }), {
        status: 403,
        type: "application/json",
      });
    await expect(
      printPdfFromUrl("/x", { fetchFn: fetchFn as unknown as typeof fetch }),
    ).rejects.toThrow("Access denied");
  });
});
