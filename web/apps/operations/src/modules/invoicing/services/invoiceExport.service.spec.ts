import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.fn();
vi.mock("./http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

import {
  buildBalanceBody,
  buildIntraEuQuery,
  invoiceExportService,
  quarterRange,
} from "./invoiceExport.service";

beforeEach(() => httpMock.mockReset());

describe("invoiceExport.service", () => {
  it("calcula el rango de un trimestre", () => {
    expect(quarterRange(2026, 1)).toEqual({ desde: "2026-01-01", hasta: "2026-03-31" });
    expect(quarterRange(2026, 2)).toEqual({ desde: "2026-04-01", hasta: "2026-06-30" });
    expect(quarterRange(2024, 4)).toEqual({ desde: "2024-10-01", hasta: "2024-12-31" });
  });

  it("arma la query de la recapitulativa", () => {
    expect(buildIntraEuQuery("2026-01-01", "2026-03-31")).toBe(
      "desde=2026-01-01&hasta=2026-03-31",
    );
    expect(buildIntraEuQuery("2026-01-01", "2026-03-31", " fr ")).toBe(
      "desde=2026-01-01&hasta=2026-03-31&pais=FR",
    );
  });

  it("arma el cuerpo del listado anual", () => {
    expect(buildBalanceBody("passive", 2025, "csv")).toEqual({
      type: "passive",
      year: 2025,
      format: "csv",
    });
  });

  it("lee el fichero de la raiz o de data", async () => {
    httpMock.mockResolvedValueOnce({ data: { csv: "QQ==", filename: "r.csv", mime_type: "text/csv" } });
    const f = await invoiceExportService.intraEu("2026-01-01", "2026-03-31");
    expect(f).toEqual({ base64: "QQ==", filename: "r.csv", mime: "text/csv" });
    expect(httpMock.mock.calls[0][0]).toBe(
      "/api_intra_eu_recap_export?desde=2026-01-01&hasta=2026-03-31",
    );
    httpMock.mockResolvedValueOnce({ file: "QQ==", filename: "b.xlsx" });
    const g = await invoiceExportService.balance("active", 2025, "xlsx");
    expect(g.filename).toBe("b.xlsx");
    expect(httpMock.mock.calls[1][1]).toEqual({
      method: "POST",
      body: { type: "active", year: 2025, format: "xlsx" },
    });
  });

  it("falla si el servidor no devuelve fichero", async () => {
    httpMock.mockResolvedValueOnce({ data: {} });
    await expect(invoiceExportService.intraEu("a", "b")).rejects.toThrow();
  });
});
