import { describe, expect, it, vi } from "vitest";

vi.mock("@shared/anagrafiche/services/http", () => ({ http: vi.fn() }));

import {
  buildAssignBody,
  buildListUrl,
  buildReconcileBody,
  buildSummaryUrl,
} from "./reconciliation.service";

describe("buildListUrl", () => {
  it("omite filtros vacíos y limita per_page a 100", () => {
    const u = buildListUrl(
      "pending",
      { date_from: "2026-01-01", date_to: "", carrier_id: null },
      0,
      500,
    );
    expect(u).toBe(
      "/api_cod_reconciliation?list=pending&page=1&per_page=100&date_from=2026-01-01",
    );
  });
  it("to_report incluye el transportista", () => {
    expect(buildListUrl("to_report", { carrier_id: 7 }, 2, 25)).toContain(
      "list=to_report&page=2&per_page=25&carrier_id=7",
    );
  });
});

describe("otros builders", () => {
  it("resumen", () => {
    expect(buildSummaryUrl("2026-01-01", "2026-01-31")).toContain(
      "summary=1&date_from=2026-01-01&date_to=2026-01-31",
    );
  });
  it("cuerpos POST", () => {
    expect(buildReconcileBody(5, "2026-02-03", "B")).toEqual({
      action: "reconcile",
      shipment_id: 5,
      collection_date: "2026-02-03",
      state: "B",
    });
    expect(buildAssignBody([1, 2], 9)).toEqual({
      action: "assign_report",
      shipment_ids: [1, 2],
      report_id: 9,
    });
  });
});
