import { describe, expect, it, vi } from "vitest";
import { deliveryNoticeAction } from "./deliveryNotice";
import { createAfterCommitQueue } from "./afterCommitQueue";
import { summarizeRechargeBulk } from "./rechargeBulk";
import { generatePdfAfterSave } from "./proformaFlow";

describe("deliveryNoticeAction (H17a)", () => {
  const base = { hasId: true, stato: "7", data: "2026-01-02", draftActive: false };
  it("pregunta cuando no hay borrador", () => {
    expect(deliveryNoticeAction(base)).toBe("ask");
  });
  it("difiere con borrador activo", () => {
    expect(deliveryNoticeAction({ ...base, draftActive: true })).toBe("defer");
  });
  it("nada si no es entregado, sin fecha o sin id", () => {
    expect(deliveryNoticeAction({ ...base, stato: "3" })).toBe("none");
    expect(deliveryNoticeAction({ ...base, data: " " })).toBe("none");
    expect(deliveryNoticeAction({ ...base, hasId: false })).toBe("none");
  });
});

describe("createAfterCommitQueue (H17a)", () => {
  it("deduplica por clave y take vacía la cola", () => {
    const q = createAfterCommitQueue();
    const fn = vi.fn();
    q.defer("a", fn);
    q.defer("a", fn);
    expect(q.size).toBe(1);
    expect(q.take()).toHaveLength(1);
    expect(q.size).toBe(0);
  });
  it("clear (cancelar) descarta las pendientes", () => {
    const q = createAfterCommitQueue();
    q.defer("a", vi.fn());
    q.clear();
    expect(q.take()).toHaveLength(0);
  });
});

describe("summarizeRechargeBulk (H12.1)", () => {
  it("cuenta y suma solo las filas seleccionadas", () => {
    const rows = [
      { id: 1, postfatt: 10.1 },
      { id: 2, postfatt: 20.2 },
      { id: 3, postfatt: 99 },
    ];
    expect(summarizeRechargeBulk(rows, [1, 2])).toEqual({ count: 2, total: 30.3 });
  });
  it("importes no numéricos suman 0 y ids ausentes cuentan", () => {
    expect(
      summarizeRechargeBulk([{ id: 1, postfatt: null }], [1, 5]),
    ).toEqual({ count: 2, total: 0 });
  });
});

describe("generatePdfAfterSave (H17b)", () => {
  it("aborta sin generar si el guardado falla", async () => {
    const gen = vi.fn();
    const r = await generatePdfAfterSave(async () => false, gen);
    expect(r).toEqual({ aborted: true });
    expect(gen).not.toHaveBeenCalled();
  });
  it("genera si el guardado va bien", async () => {
    const r = await generatePdfAfterSave(async () => true, async () => 42);
    expect(r).toEqual({ aborted: false, result: 42 });
  });
});
