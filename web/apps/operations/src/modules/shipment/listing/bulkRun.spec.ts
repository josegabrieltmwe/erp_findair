import { describe, expect, it } from "vitest";
import {
  BULK_MAX,
  classifyBulkError,
  sanitizeBulkIds,
  summarizeBulk,
} from "@shared/listing/bulkRun";

const loaded = new Set([1, 2, 3, 4, 5]);

describe("sanitizeBulkIds (superficie de ataque del lote)", () => {
  it("deja solo ids enteros positivos, sin repetir, que estén en las filas cargadas", () => {
    const r = sanitizeBulkIds([1, 2, 2, 3], loaded);
    expect(r.ids).toEqual([1, 2, 3]);
    expect(r.foreign).toBe(0);
  });

  it("descarta un id ajeno aunque llegue en la selección (no está en las filas cargadas)", () => {
    const r = sanitizeBulkIds([1, 999, 3], loaded);
    expect(r.ids).toEqual([1, 3]);
    expect(r.foreign).toBe(1);
  });

  it("descarta valores que no son ids válidos (negativos, cero, decimales, texto, inyección)", () => {
    const r = sanitizeBulkIds(
      [-1, 0, 1.5, "abc", "1 OR 1=1", null, undefined, NaN, "2"],
      loaded,
    );
    // "2" es el único que, normalizado a número, está cargado
    expect(r.ids).toEqual([2]);
    expect(r.foreign).toBe(8);
  });

  it("recorta al tope y lo señala", () => {
    const many = new Set(Array.from({ length: BULK_MAX + 50 }, (_, i) => i + 1));
    const r = sanitizeBulkIds([...many], many);
    expect(r.ids).toHaveLength(BULK_MAX);
    expect(r.overLimit).toBe(true);
  });

  it("sin filas cargadas no se envía nada", () => {
    expect(sanitizeBulkIds([1, 2], new Set()).ids).toEqual([]);
  });
});

describe("summarizeBulk", () => {
  it("sin applied/skipped, todo lo pedido se da por aplicado", () => {
    expect(summarizeBulk([1, 2], { success: true })).toEqual({
      applied: [1, 2],
      skipped: [],
    });
  });

  it("lo omitido no cuenta como aplicado", () => {
    const r = summarizeBulk([1, 2, 3], {
      success: true,
      applied: [1, 3],
      skipped: [{ id: 2, reason: "CONTROLLED" }],
    });
    expect(r.applied).toEqual([1, 3]);
    expect(r.skipped).toEqual([{ id: 2, reason: "CONTROLLED" }]);
  });

  it("ignora ids que el API devuelve y no se habían pedido", () => {
    const r = summarizeBulk([1], {
      success: true,
      applied: [1, 77],
      skipped: [{ id: 88, reason: "X" }],
    });
    expect(r.applied).toEqual([1]);
    expect(r.skipped).toEqual([]);
  });
});

describe("classifyBulkError", () => {
  it("403 / ACCESS_DENIED = algún id no es del usuario; no se detalla ni se reintenta", () => {
    expect(classifyBulkError({ status: 403 }).kind).toBe("denied");
    expect(classifyBulkError({ errorCode: "ACCESS_DENIED" }).kind).toBe(
      "denied",
    );
    expect(classifyBulkError({ status: 403 }).skipped).toEqual([]);
  });

  it("409 NOT_APPLICABLE lleva las omitidas", () => {
    const f = classifyBulkError({
      status: 409,
      message: "m",
      payload: { error: { details: { skipped: [{ id: 1, reason: "R" }] } } },
    });
    expect(f.kind).toBe("not_applicable");
    expect(f.skipped).toEqual([{ id: 1, reason: "R" }]);
  });

  it("otro error conserva el mensaje", () => {
    expect(classifyBulkError(new Error("boom"))).toMatchObject({
      kind: "other",
      message: "boom",
    });
  });
});
