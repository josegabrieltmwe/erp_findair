import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, reactive } from "vue";
import { useProposalCard } from "./useProposalCard";
import { newView, parseProposal } from "../services/proposal";
import { rawCancel, rawProposal } from "../services/fixtures";

function setup(raw = rawProposal()) {
  const view = reactive(newView(parseProposal(raw)!, Date.now()));
  const scope = effectScope();
  const card = scope.run(() => useProposalCard(() => view))!;
  return { view, card, scope };
}

describe("useProposalCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T08:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("cuenta atras de 300 s hasta caducar y bloquea Confirmar", () => {
    const { card, scope } = setup();
    expect(card.countdown.value).toBe("5:00");
    expect(card.canConfirm.value).toBe(true);
    vi.advanceTimersByTime(61_000);
    expect(card.countdown.value).toBe("3:59");
    vi.advanceTimersByTime(239_000);
    expect(card.remaining.value).toBe(0);
    expect(card.expired.value).toBe(true);
    expect(card.canConfirm.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0); // el temporizador se detiene
    scope.stop();
  });

  it("al destruir el scope no queda temporizador", () => {
    const { scope } = setup();
    expect(vi.getTimerCount()).toBe(1);
    scope.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancel: Confirmar solo tras el segundo gesto", () => {
    const { card, scope } = setup(rawCancel());
    expect(card.reinforced.value).toBe(true);
    expect(card.canConfirm.value).toBe(false);
    card.acknowledged.value = true;
    expect(card.canConfirm.value).toBe(true);
    expect(card.targetName.value).toBe("176-123");
    scope.stop();
  });

  it("no se puede confirmar en estados terminales ni mientras confirma", () => {
    const { view, card, scope } = setup();
    for (const status of [
      "confirming",
      "verified",
      "rejected",
      "mismatch",
      "unverified",
      "dismissed",
    ] as const) {
      view.status = status;
      expect(card.canConfirm.value, status).toBe(false);
    }
    view.status = "error";
    view.retryable = false;
    expect(card.canConfirm.value).toBe(false);
    view.retryable = true;
    expect(card.canConfirm.value).toBe(true);
    scope.stop();
  });

  it("crear expedicion no pide segundo gesto", () => {
    const { card, scope } = setup();
    expect(card.reinforced.value).toBe(false);
    expect(card.rows.value.length).toBeGreaterThan(0);
    scope.stop();
  });
});
