import { http } from "./http";

/**
 * Cargo pricing recalc service — modern endpoint.
 *
 *   - POST /api_cargo_pricing_recalc → Pricing_Recalc_Controller
 *
 * WS-4: el backend YA es NATIVO (Cargo_Charge_Calculation_Service::recalculate).
 * Ya no hace include del legacy spedyc_dettaglio_recalc.php. Suma las voci,
 * aplica margen/seguro/divisa y persiste respetando locks. Devuelve la fila
 * releída (data) + los `totals` calculados.
 */

export interface PricingRecalcInput {
  cargo_id: number;
  /** Trigger source — informational only. */
  trigger?: "weight" | "flight" | "currency" | "manual";
}

export interface PricingRecalcResult {
  success: boolean;
  data?: {
    cargo_id?: number;
    carico_export?: string | null;
    carico_import?: string | null;
    carico_volo?: string | null;
    costo_volo_previsto?: string | null;
    costo_volo_reale?: string | null;
    carico_extra?: string | null;
    currency?: string;
  };
  trigger?: string;
  /** Totales calculados por el recalc nativo (transparencia). */
  totals?: Record<string, number> | null;
  error?: string;
}

interface RecalcResponse {
  success: boolean;
  cargo_id: number;
  trigger: string;
  data: PricingRecalcResult["data"];
  totals?: Record<string, number> | null;
  error?: string;
}

export const pricingService = {
  async recalculate(input: PricingRecalcInput): Promise<PricingRecalcResult> {
    try {
      const r = await http<RecalcResponse>("/api_cargo_pricing_recalc", {
        method: "POST",
        body: { cargo_id: input.cargo_id, trigger: input.trigger ?? "manual" },
      });
      if (!r?.success) {
        return { success: false, error: r?.error ?? "Recalc failed" };
      }
      return {
        success: true,
        data: { ...r.data, cargo_id: r.cargo_id },
        trigger: r.trigger,
        totals: r.totals ?? null,
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};
