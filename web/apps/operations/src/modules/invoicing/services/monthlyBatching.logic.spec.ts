import { describe, expect, it, vi } from "vitest";

vi.mock("./http", () => ({ http: vi.fn() }));

import {
  DEFAULT_BATCH_SIZE,
  chunkClientIds,
  classifyBatchFailure,
  computeProgress,
  mergeBatchResponse,
  runBatches,
} from "./monthlyBatching.logic";
import type { EmitResponse, ResultRow } from "./monthlyBilling.service";

const ok = (ids: number[]): EmitResponse => ({
  generated: ids.map((id) => ({ id_fattura: id * 10, id_anagrafica: id, numero: `F${id}` })),
  errors: [],
  skipped: [],
  warnings: [],
});
const apiErr = (status?: number, errorCode?: string, message = "m") =>
  Object.assign(new Error(message), { status, errorCode });

describe("chunkClientIds", () => {
  it("default 25 y reparte el resto en la ultima tanda", () => {
    expect(DEFAULT_BATCH_SIZE).toBe(25);
    const ids = Array.from({ length: 60 }, (_, i) => i + 1);
    expect(chunkClientIds(ids).map((b) => b.length)).toEqual([25, 25, 10]);
  });
  it("tamano personalizado, duplicados y vacio", () => {
    expect(chunkClientIds([1, 2, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(chunkClientIds([])).toEqual([]);
    expect(chunkClientIds([1, 2], 0)).toEqual([[1, 2]]);
  });
});

describe("classifyBatchFailure", () => {
  it("clasifica", () => {
    expect(classifyBatchFailure(apiErr(422, "INVOICE_DATE_NOT_CHRONOLOGICAL")).kind).toBe("date");
    expect(classifyBatchFailure(apiErr(403)).kind).toBe("forbidden");
    expect(classifyBatchFailure(apiErr(500)).kind).toBe("uncertain");
    expect(classifyBatchFailure(apiErr(504)).kind).toBe("uncertain");
    expect(classifyBatchFailure(new TypeError("network")).kind).toBe("uncertain");
    expect(classifyBatchFailure(apiErr(422, "OTHER")).kind).toBe("rejected");
    expect(classifyBatchFailure(apiErr(400)).kind).toBe("rejected");
  });
});

describe("mergeBatchResponse / computeProgress", () => {
  it("acumula filas y avisos sin duplicar", () => {
    let acc: { rows: ResultRow[]; warnings: string[] } = { rows: [], warnings: [] };
    acc = mergeBatchResponse(acc, { ...ok([1]), warnings: ["w"] });
    acc = mergeBatchResponse(acc, {
      generated: [],
      skipped: [{ id_anagrafica: 2, reason: "NOTHING_BILLABLE" }],
      errors: [{ id_anagrafica: 3, error: "boom" }],
      warnings: ["w", "w2"],
    });
    expect(acc.rows.map((r) => r.kind)).toEqual(["generated", "nothing", "error"]);
    expect(acc.warnings).toEqual(["w", "w2"]);
  });
  it("progreso", () => {
    const b = [[1, 2], [3, 4], [5]];
    expect(computeProgress(b, 0)).toMatchObject({ doneClients: 0, totalClients: 5, percent: 0 });
    expect(computeProgress(b, 2)).toMatchObject({ doneClients: 4, doneBatches: 2, totalBatches: 3, percent: 80 });
    expect(computeProgress(b, 9).percent).toBe(100);
    expect(computeProgress([], 0).percent).toBe(0);
  });
});

describe("runBatches", () => {
  const batches = [[1, 2], [3, 4], [5, 6], [7, 8]];

  it("todo OK: envia en orden una vez cada tanda", async () => {
    const send = vi.fn(async (ids: number[]) => ok(ids));
    const progress: number[] = [];
    const r = await runBatches({ batches, send, onProgress: (p) => progress.push(p.percent) });
    expect(send.mock.calls.map((c) => c[0])).toEqual(batches);
    expect(r.stop).toBe("none");
    expect(r.completed).toEqual([0, 1, 2, 3]);
    expect(r.rows).toHaveLength(8);
    expect(progress).toEqual([0, 25, 50, 75, 100]);
  });

  it("error de red en la tanda 2 de 4: para, tanda incierta, sin reintento", async () => {
    const send = vi.fn(async (ids: number[], i: number) => {
      if (i === 1) throw apiErr(undefined);
      return ok(ids);
    });
    const r = await runBatches({ batches, send });
    expect(send).toHaveBeenCalledTimes(2);
    expect(r.stop).toBe("uncertain");
    expect(r.completed).toEqual([0]);
    expect(r.uncertain).toBe(1);
    expect(r.notSent).toEqual([2, 3]);
    expect(r.anySent).toBe(true);
    expect(r.rows).toHaveLength(2);
  });

  it("5xx tambien es incierto", async () => {
    const send = vi.fn(async () => {
      throw apiErr(502);
    });
    const r = await runBatches({ batches, send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.uncertain).toBe(0);
    expect(r.notSent).toEqual([1, 2, 3]);
  });

  it("422 de fecha en la primera: rechazada, nada emitido", async () => {
    const send = vi.fn(async () => {
      throw apiErr(422, "INVOICE_DATE_NOT_CHRONOLOGICAL", "fecha");
    });
    const r = await runBatches({ batches, send });
    expect(r.stop).toBe("date");
    expect(r.rejected).toBe(0);
    expect(r.uncertain).toBeNull();
    expect(r.anySent).toBe(false);
    expect(r.failureMessage).toBe("fecha");
    expect(r.notSent).toEqual([1, 2, 3]);
  });

  it("403 en la tanda 3: para; las anteriores cuentan como enviadas", async () => {
    const send = vi.fn(async (ids: number[], i: number) => {
      if (i === 2) throw apiErr(403);
      return ok(ids);
    });
    const r = await runBatches({ batches, send });
    expect(r.stop).toBe("forbidden");
    expect(r.completed).toEqual([0, 1]);
    expect(r.rejected).toBe(2);
    expect(r.anySent).toBe(true);
    expect(r.notSent).toEqual([3]);
  });

  it("errores por cliente (200) no paran", async () => {
    const send = vi.fn(async (ids: number[], i: number) =>
      i === 1
        ? { generated: [], skipped: [], errors: ids.map((id) => ({ id_anagrafica: id, error: "x" })) }
        : ok(ids),
    );
    const r = await runBatches({ batches, send });
    expect(send).toHaveBeenCalledTimes(4);
    expect(r.stop).toBe("none");
    expect(r.rows.filter((x) => x.kind === "error")).toHaveLength(2);
    expect(r.rows.filter((x) => x.kind === "generated")).toHaveLength(6);
  });

  it("parar tras la tanda en curso", async () => {
    let stop = false;
    const send = vi.fn(async (ids: number[], i: number) => {
      if (i === 1) stop = true; // el usuario pulsa durante la tanda 2
      return ok(ids);
    });
    const r = await runBatches({ batches, send, shouldStop: () => stop });
    expect(send).toHaveBeenCalledTimes(2);
    expect(r.stop).toBe("user");
    expect(r.completed).toEqual([0, 1]);
    expect(r.notSent).toEqual([2, 3]);
    expect(r.uncertain).toBeNull();
  });

  it("sin tandas", async () => {
    const r = await runBatches({ batches: [], send: vi.fn() });
    expect(r.stop).toBe("none");
    expect(r.anySent).toBe(false);
  });
});
