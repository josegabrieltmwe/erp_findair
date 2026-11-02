import { afterEach, describe, expect, it } from "vitest";
import { readIsTmwe } from "@shared/anagrafiche/composables/useAnagraficaContext";

function setWindow(w: Record<string, unknown>) {
  (globalThis as unknown as { window: unknown }).window = w;
}

describe("readIsTmwe (H6)", () => {
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("lee __TMWE_OPERATIONS__.isTmwe cuando no hay otro global", () => {
    setWindow({ __TMWE_OPERATIONS__: { isTmwe: true } });
    expect(readIsTmwe()).toBe(true);
  });

  it("los overrides explicitos tienen prioridad sobre el bootstrap del BFF", () => {
    setWindow({ __TMWE_ANAGRAFICA_CTX__: { isTmwe: false }, __TMWE_OPERATIONS__: { isTmwe: true } });
    expect(readIsTmwe()).toBe(false);
    setWindow({ __TMWE_PARTNER_CLIENTS__: { isTmwe: true }, __TMWE_OPERATIONS__: { isTmwe: false } });
    expect(readIsTmwe()).toBe(true);
  });

  it("sin ningun global es false (minimo privilegio)", () => {
    setWindow({});
    expect(readIsTmwe()).toBe(false);
  });
});
