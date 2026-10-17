import { describe, expect, it } from "vitest";
import { canTransmit } from "./invoiceActions";

describe("canTransmit", () => {
  it("solo con permiso de envío", () => {
    expect(canTransmit({ canSend: true })).toBe(true);
    expect(canTransmit({ canSend: false })).toBe(false);
  });
  it("nunca para el partner", () => {
    expect(canTransmit({ canSend: true }, "partner")).toBe(false);
  });
});
