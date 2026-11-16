import { afterEach, describe, expect, it } from "vitest";
import { isRealTmweUser, isTmweWithoutImpersonation, listViewMode } from "./tmweSession";

function setBootstrap(v: Record<string, unknown> | undefined): void {
  (globalThis as unknown as { window?: unknown }).window =
    v === undefined ? undefined : { __TMWE_OPERATIONS__: v };
}
afterEach(() => setBootstrap(undefined));

describe("isTmweWithoutImpersonation (N15, collaudo 16/11)", () => {
  it("TMWE sin suplantar: true", () => {
    setBootstrap({ isTmwe: true });
    expect(isTmweWithoutImpersonation()).toBe(true);
  });

  it("TMWE suplantando a un partner: false (toma las caracteristicas del partner)", () => {
    setBootstrap({ isTmwe: true, impersonating: true });
    expect(isTmweWithoutImpersonation()).toBe(false);
    // El usuario real sigue siendo TMWE (para que el selector de partner no desaparezca).
    expect(isRealTmweUser()).toBe(true);
  });

  it("partner (no TMWE), con o sin bootstrap: false", () => {
    setBootstrap({ isTmwe: false });
    expect(isTmweWithoutImpersonation()).toBe(false);
    setBootstrap(undefined);
    expect(isTmweWithoutImpersonation()).toBe(false);
    expect(listViewMode()).toBeUndefined();
  });
});
