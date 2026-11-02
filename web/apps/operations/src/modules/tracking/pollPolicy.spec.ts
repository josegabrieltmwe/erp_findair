import { describe, expect, it } from "vitest";
import { POLL_MAX_CONSECUTIVE_ERRORS, POLL_MAX_WAIT_MS, pollGiveUp } from "./pollPolicy";

describe("pollGiveUp (H17c)", () => {
  it("sigue sondeando dentro de los limites", () => {
    expect(pollGiveUp(0, 0)).toBeNull();
    expect(pollGiveUp(POLL_MAX_WAIT_MS, POLL_MAX_CONSECUTIVE_ERRORS - 1)).toBeNull();
  });

  it("se rinde por tiempo", () => {
    expect(pollGiveUp(POLL_MAX_WAIT_MS + 1, 0)).toBe("timeout");
  });

  it("se rinde por errores seguidos, aunque no haya vencido el tiempo", () => {
    expect(pollGiveUp(1000, POLL_MAX_CONSECUTIVE_ERRORS)).toBe("errors");
  });
});
