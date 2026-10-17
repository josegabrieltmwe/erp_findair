import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

import { invoiceService } from "./invoice.service";

beforeEach(() => httpMock.mockReset());

describe("billableShipments", () => {
  it("expone el diagnóstico NOT_CONTROLLED que da el backend", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: [],
      diagnostics: [{ tipo: "cargo", id: 50, code: "NOT_CONTROLLED" }],
    });
    const res = await invoiceService.billableShipments(100, {
      id_spediz: "50",
      tipo: "cargo",
    });
    expect(httpMock.mock.calls[0][0]).toContain("tipo=cargo");
    expect(res.diagnostics?.[0].code).toBe("NOT_CONTROLLED");
  });
});

describe("generateBatch", () => {
  it("devuelve skipped y diagnostics, sin perderlos", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: {
        generated: [],
        errors: [],
        skipped: [{ id_anagrafica: 100, reason: "NOTHING_BILLABLE" }],
        diagnostics: [{ tipo: "express", id: 7, code: "NOT_CONTROLLED" }],
      },
    });
    const res = await invoiceService.generateBatch({});
    expect(res.skipped).toHaveLength(1);
    expect(res.diagnostics[0].code).toBe("NOT_CONTROLLED");
  });

  it("sin diagnostics los campos nuevos son listas vacías", async () => {
    httpMock.mockResolvedValue({ success: true, data: { generated: [] } });
    const res = await invoiceService.generateBatch({});
    expect(res.skipped).toEqual([]);
    expect(res.diagnostics).toEqual([]);
  });
});
