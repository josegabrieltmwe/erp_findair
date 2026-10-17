import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@tmwe/shared-frontend/http";

const httpMock = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));
vi.mock("@shared/anagrafiche/services/payments.service", () => ({
  paymentsService: { paymentMethods: vi.fn() },
}));

import {
  buildListQuery,
  csvCell,
  paymentsApi,
  parseBulkErrors,
  toCsv,
} from "./payments.service";

beforeEach(() => {
  httpMock.mockReset();
});

describe("buildListQuery", () => {
  it("omite filtros vacíos y limita per_page a 100", () => {
    const q = buildListQuery(
      {
        tipo: "A",
        statop: undefined,
        scad_dal: "",
        importo: null,
        id_anagrafica: 7,
      },
      { page: 2, perPage: 500, sort: "importo", sortDir: "DESC" },
    );
    expect(q).toEqual({
      tipo: "A",
      id_anagrafica: 7,
      page: 2,
      per_page: 100,
      sort: "importo",
      sort_dir: "DESC",
    });
  });
});

describe("paymentsApi", () => {
  it("list: lee paginación y total del resumen", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: [{ id: 1, importo: "10.50", days_overdue: "3" }],
      pagination: { total: 42 },
      summary: { total_amount: "999.9" },
    });
    const res = await paymentsApi.list({ tipo: "P" }, { page: 1, perPage: 25 });
    expect(httpMock.mock.calls[0][0]).toBe("/api_payments");
    expect(httpMock.mock.calls[0][1].query).toMatchObject({
      tipo: "P",
      page: 1,
      per_page: 25,
    });
    expect(res.total).toBe(42);
    expect(res.totalAmount).toBe(999.9);
    expect(res.rows[0].importo).toBe(10.5);
  });

  it("register: omite amount cuando es cobro total", async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });
    await paymentsApi.register({ id: 5, date: "2026-01-31" });
    const [url, opts] = httpMock.mock.calls[0];
    expect(url).toBe("/api_payments");
    expect(opts.method).toBe("POST");
    expect(opts.query).toEqual({ op: "register" });
    expect(opts.body).toEqual({ id: 5, date: "2026-01-31" });
  });

  it("register: manda amount y método en cobro parcial", async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });
    await paymentsApi.register({
      id: 5,
      date: "2026-01-31",
      amount: 40,
      id_pagam_metodi: 3,
    });
    expect(httpMock.mock.calls[0][1].body).toEqual({
      id: 5,
      date: "2026-01-31",
      amount: 40,
      id_pagam_metodi: 3,
    });
  });

  it("reopen: POST op=reopen", async () => {
    httpMock.mockResolvedValue({ success: true });
    await paymentsApi.reopen(9);
    expect(httpMock.mock.calls[0][1].query).toEqual({ op: "reopen" });
    expect(httpMock.mock.calls[0][1].body).toEqual({ id: 9 });
  });

  it("bulkCollect: devuelve los errores por fila de un 422", async () => {
    const payload = {
      error: {
        details: { validation_errors: [{ id: 2, reason: "already closed" }] },
      },
    };
    httpMock.mockRejectedValue(
      new ApiError("Invalid", 422, "VALIDATION", payload),
    );
    const res = await paymentsApi.bulkCollect([1, 2], "2026-02-01");
    expect(res.ok).toBe(false);
    expect(res.errors).toEqual([{ id: 2, reason: "already closed" }]);
  });

  it("bulkCollect: relanza otros errores (409)", async () => {
    httpMock.mockRejectedValue(new ApiError("Conflict", 409));
    await expect(
      paymentsApi.bulkCollect([1], "2026-02-01"),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("aging: traduce los parámetros a customer_id / days_threshold", async () => {
    httpMock.mockResolvedValue({ data: {} });
    await paymentsApi.aging({ customerId: 4, daysThreshold: 15 });
    expect(httpMock.mock.calls[0][1].query).toEqual({
      customer_id: 4,
      days_threshold: 15,
    });
  });

  it("reconcileFile: envía multipart con statement, format y delimiter", async () => {
    httpMock.mockResolvedValue({ data: { matched: [], unmatched: [] } });
    const file = new File(["x"], "extracto.csv");
    await paymentsApi.reconcileFile(file, { format: "csv", delimiter: ";" });
    const [url, opts] = httpMock.mock.calls[0];
    expect(url).toBe("/api_bank_reconciliation");
    expect(opts.method).toBe("POST");
    const form = opts.body as FormData;
    expect(form.get("statement")).toBeInstanceOf(File);
    expect(form.get("format")).toBe("csv");
    expect(form.get("delimiter")).toBe(";");
  });

  it("confirmMatches: PUT con matches", async () => {
    httpMock.mockResolvedValue({ data: { confirmed: 1, errors: [] } });
    const matches = [
      {
        pagamento_id: 1,
        transaction_ref: "R1",
        data_close: "2026-02-01",
        amount: 5,
      },
    ];
    const res = await paymentsApi.confirmMatches(matches);
    expect(httpMock.mock.calls[0][1].method).toBe("PUT");
    expect(httpMock.mock.calls[0][1].body).toEqual({ matches });
    expect(res.confirmed).toBe(1);
  });

  it("listAll: recorre todas las páginas", async () => {
    const page = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: i, importo: 1 }));
    httpMock
      .mockResolvedValueOnce({ data: page(100), pagination: { total: 130 } })
      .mockResolvedValueOnce({ data: page(30), pagination: { total: 130 } });
    const all = await paymentsApi.listAll(
      {},
      { sort: "scadenza", sortDir: "ASC" },
    );
    expect(all).toHaveLength(130);
    expect(httpMock).toHaveBeenCalledTimes(2);
    expect(httpMock.mock.calls[1][1].query.page).toBe(2);
  });
});

describe("utilidades", () => {
  it("parseBulkErrors tolera formas distintas", () => {
    expect(parseBulkErrors(null)).toEqual([]);
    expect(
      parseBulkErrors({
        details: { validation_errors: [{ id: "3", reason: "x" }] },
      }),
    ).toEqual([{ id: 3, reason: "x" }]);
  });

  it("toCsv escapa separadores y comillas", () => {
    expect(csvCell('a;b"c')).toBe('"a;b""c"');
    expect(toCsv(["h1", "h2"], [["x", 'y"z']])).toBe('h1;h2\r\nx;"y""z"');
  });
});
