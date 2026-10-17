import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

import {
  buildImportForm,
  carrierReconApi,
  checkNeedsAttention,
  overviewNeedsAttention,
  deltaOf,
  MAX_CARRIER_BYTES,
  rowNeedsAttention,
  validateCarrierFile,
  type ImportRow,
} from "./carrierRecon.service";

beforeEach(() => httpMock.mockReset());

const row = (p: Partial<ImportRow>): ImportRow => ({
  line: 1,
  awb: "",
  riferimento: "",
  shipment_id: null,
  amount: null,
  overrun: false,
  status: "associated",
  message: "",
  ...p,
});

describe("validateCarrierFile", () => {
  it("valida tipo y tamaño", () => {
    expect(validateCarrierFile({ name: "BRT.CSV", size: 10 })).toBe("ok");
    expect(validateCarrierFile({ name: "a.pdf", size: 10 })).toBe("bad_type");
    expect(
      validateCarrierFile({ name: "a.csv", size: MAX_CARRIER_BYTES + 1 }),
    ).toBe("too_big");
    expect(validateCarrierFile(undefined)).toBe("missing");
  });
});

describe("buildImportForm", () => {
  it("manda dry_run solo cuando se pide y carrier solo si se eligió", () => {
    const f = buildImportForm(7, new File(["x"], "a.csv"), "", true);
    expect(f.get("invoice_id")).toBe("7");
    expect(f.get("dry_run")).toBe("1");
    expect(f.has("carrier")).toBe(false);
    const g = buildImportForm(7, new File(["x"], "a.csv"), "DHL", false);
    expect(g.get("carrier")).toBe("DHL");
    expect(g.has("dry_run")).toBe(false);
  });
});

describe("filas", () => {
  it("detecta las que requieren atención", () => {
    expect(rowNeedsAttention(row({}))).toBe(false);
    expect(rowNeedsAttention(row({ overrun: true }))).toBe(true);
    expect(rowNeedsAttention(row({ status: "not_found" }))).toBe(true);
  });
  it("calcula la diferencia", () => {
    expect(deltaOf({ costo_previsto: "10.10", costo_reale: 10.35 })).toBe(0.25);
  });
});

describe("carrierReconApi", () => {
  it("list usa op=discrepancies solo si se piden", async () => {
    httpMock.mockResolvedValue({ success: true, data: [], summary: {} });
    await carrierReconApi.list(5, {
      onlyDiscrepancies: true,
      page: 1,
      perPage: 500,
    });
    expect(httpMock.mock.calls[0][1].query).toMatchObject({
      invoice_id: 5,
      op: "discrepancies",
      per_page: 100,
    });
    await carrierReconApi.list(5, {
      onlyDiscrepancies: false,
      page: 1,
      perPage: 20,
    });
    expect(httpMock.mock.calls[1][1].query).not.toHaveProperty("op");
  });
  it("accept manda el motivo recortado", async () => {
    httpMock.mockResolvedValue({ success: true });
    await carrierReconApi.accept(5, 9, "  ok  ");
    expect(httpMock.mock.calls[0][1].body).toEqual({
      op: "accept",
      invoice_id: 5,
      shipment_id: 9,
      reason: "ok",
    });
  });
});

describe("incidencias guardadas", () => {
  it("pide op=checks con el tipo solo si se filtra y limita la página", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: [{ id: 1, tipo_record: "S", id_spediz: 9 }],
      pagination: { total: 4 },
      by_type: { S: 2, A: 3 },
    });
    const r = await carrierReconApi.checks(5, {
      tipo: "S",
      page: 2,
      perPage: 500,
    });
    const [url, opts] = httpMock.mock.calls[0];
    expect(url).toBe("/api_carrier_reconciliation");
    expect(opts.query).toEqual({
      op: "checks",
      invoice_id: 5,
      page: 2,
      per_page: 100,
      tipo: "S",
    });
    expect(r.total).toBe(4);
    expect(r.byType).toEqual({ S: 2, A: 3 });
    expect(r.items).toHaveLength(1);

    httpMock.mockResolvedValue({ success: true, data: null });
    const empty = await carrierReconApi.checks(5, {
      tipo: "",
      page: 1,
      perPage: 20,
    });
    expect(httpMock.mock.calls[1][1].query).not.toHaveProperty("tipo");
    expect(empty).toEqual({ items: [], total: 0, byType: {} });
  });
  it("las asociadas y la cabecera no piden revisión", () => {
    expect(checkNeedsAttention("S")).toBe(true);
    expect(checkNeedsAttention("N")).toBe(true);
    expect(checkNeedsAttention("A")).toBe(false);
    expect(checkNeedsAttention("C")).toBe(false);
  });
});

describe("vista global", () => {
  it("pide op=overview con atención y desde, y limita la página", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: [{ id: 3, status: "discrepancies" }],
      pagination: { total: 7 },
      from: "2026-07-16",
      tolerance: 0.05,
    });
    const r = await carrierReconApi.overview({
      attention: true,
      from: "2026-07-01",
      page: 1,
      perPage: 500,
    });
    expect(httpMock.mock.calls[0][1].query).toEqual({
      op: "overview",
      page: 1,
      per_page: 100,
      attention: 1,
      from: "2026-07-01",
    });
    expect(r).toMatchObject({ total: 7, from: "2026-07-16", tolerance: 0.05 });
    httpMock.mockResolvedValue({ success: true, data: null });
    await carrierReconApi.overview({ attention: false, page: 2, perPage: 10 });
    expect(httpMock.mock.calls[1][1].query).toEqual({
      op: "overview",
      page: 2,
      per_page: 10,
    });
  });
  it("marca las que piden atención", () => {
    expect(overviewNeedsAttention({ status: "empty" })).toBe(true);
    expect(overviewNeedsAttention({ status: "discrepancies" })).toBe(true);
    expect(overviewNeedsAttention({ status: "recharge" })).toBe(true);
    expect(overviewNeedsAttention({ status: "pending" })).toBe(false);
    expect(overviewNeedsAttention({ status: "ok" })).toBe(false);
  });
});
