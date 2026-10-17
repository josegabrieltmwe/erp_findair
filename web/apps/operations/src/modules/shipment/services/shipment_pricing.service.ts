/**
 * Shipment pricing breakdown REST client.
 *
 * Backend: tmwe_json\controller\web\courier\pricing\Web_Shipment_Pricing_Breakdown_Controller
 * Endpoint: GET /api_shipment_pricing_breakdown?shipment_id=N
 *
 * Shape mirrors the cargo equivalent so the modal component can be a
 * straight port. Differences specific to courier: the carrier cost
 * comes from `costo_previsto`/`costo_reale` directly (no per-line
 * recalc); supplements are returned both globally in `lines` and
 * split into `client_supplements` / `supplier_supplements` so the UI
 * can render them under the "Carico" tab when relevant.
 */
import { http } from "./http";

export interface ShipmentPricingLine {
  id: number;
  id_cargo: number;
  tipo: string;
  type: string;
  code: string;
  nome: string;
  somma: string;
  costo_unit: number;
  costo_min: number;
  costo_max: number;
}

export interface ShipmentPricingSupplement {
  id: number;
  code: string;
  description: string;
  attivo: "S" | "N" | string;
  amount: number;
  valuta: string;
}

export interface ShipmentPricingBreakdown {
  base: {
    peso_tassabile: number;
    coeff_volm: number;
    scaglione_kg: number;
    scaglione_pr: number;
  };
  lines: ShipmentPricingLine[];
  surcharges: { code: string; amount: number; valuta: string }[];
  insurance: {
    perc: number;
    min: number;
    amount: number;
    valuta: string;
  } | null;
  currency_chain: string[];
  totals: {
    costo: number;
    carico: number;
    profit_perc: number;
    utile_previsto: number;
  };
  client_supplements: ShipmentPricingSupplement[];
  supplier_supplements: ShipmentPricingSupplement[];
  shipment: {
    id: number;
    colli: number;
    peso: number;
    peso_tassato: number;
    peso_reale: number;
    postfatt: number;
    giac_ricons: number;
  };
}

export const shipmentPricingService = {
  breakdown(shipment_id: number): Promise<ShipmentPricingBreakdown> {
    return http<ShipmentPricingBreakdown>("/api_shipment_pricing_breakdown", {
      query: { shipment_id },
    });
  },
};
