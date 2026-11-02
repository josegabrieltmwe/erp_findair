import { describe, expect, it } from "vitest";
import { cargoActionsService } from "./cargo_actions.service";

type Sent = { url: string; body: Record<string, unknown> };

function mockFetch(status: number, body: unknown, sent: Sent[]): () => void {
  const g = globalThis as unknown as { fetch: unknown };
  const prev = g.fetch;
  g.fetch = async (input: unknown, init?: { body?: string }) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    sent.push({ url, body: init?.body ? JSON.parse(init.body) : {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return () => {
    g.fetch = prev;
  };
}

const conflict = (code: string, message: string, details: Record<string, unknown>) => ({
  success: false,
  error: { code, message, details },
  error_code: code,
  message,
});

describe("cargoActionsService.cancel (P43)", () => {
  it("devuelve el código, el motivo y los detalles del 409 del servidor", async () => {
    const sent: Sent[] = [];
    const restore = mockFetch(
      409,
      conflict("CARGO_HAS_AWB", "Cargo has an issued AWB", { awb: "176-1234" }),
      sent,
    );
    try {
      const r = await cargoActionsService.cancel(55, "motivo");
      expect(r).toMatchObject({
        success: false,
        status: 409,
        code: "CARGO_HAS_AWB",
        error: "Cargo has an issued AWB",
        details: { awb: "176-1234" },
      });
      expect(sent[0].body).toEqual({ cargo_id: 55, reason: "motivo" });
    } finally {
      restore();
    }
  });

  it("envía force solo cuando se pide", async () => {
    const sent: Sent[] = [];
    const restore = mockFetch(200, { success: true, cargo_id: 55, new_stato: "O" }, sent);
    try {
      const r = await cargoActionsService.cancel(55, "", true);
      expect(r.success).toBe(true);
      expect(sent[0].body).toEqual({ cargo_id: 55, reason: "", force: true });
    } finally {
      restore();
    }
  });

  it("un error objeto en un 200 no sale como [object Object]", async () => {
    const restore = mockFetch(
      200,
      { success: false, error: { code: "X", message: "Falló" } },
      [],
    );
    try {
      const r = await cargoActionsService.cancel(1);
      expect(r.error).toBe("Falló");
    } finally {
      restore();
    }
  });
});
