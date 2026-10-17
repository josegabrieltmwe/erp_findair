/**
 * Panel operativo diario (api_operations_panel). Un único GET con param `view`:
 *   (default)      → overview del día (prese + giacenze + entregas pendientes)
 *   view=drivers   → detalle de prese por autista
 *   view=alerts    → alertas de giacenze sobre un umbral
 */
import { http } from "@shared/anagrafiche/services/http";
import type { ApiEnvelope, OperationsOverview } from "../types";

export const operationsService = {
  async overview(date?: string): Promise<OperationsOverview> {
    const query: Record<string, string> = {};
    if (date) query.date = date;
    const r = await http<ApiEnvelope<OperationsOverview>>(
      "/api_operations_panel",
      { method: "GET", query },
    );
    return r.data;
  },

  async byDriver(date?: string): Promise<unknown> {
    const query: Record<string, string> = { view: "drivers" };
    if (date) query.date = date;
    const r = await http<ApiEnvelope<unknown>>("/api_operations_panel", {
      method: "GET",
      query,
    });
    return r.data;
  },

  async alerts(threshold = 15): Promise<unknown> {
    const r = await http<ApiEnvelope<unknown>>("/api_operations_panel", {
      method: "GET",
      query: { view: "alerts", threshold: String(threshold) },
    });
    return r.data;
  },
};
