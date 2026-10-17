import { http } from "./http";

/**
 * Rate-calculation timing of a shipment (legacy Debug Timing B2B). Read from
 * Elasticsearch via the shipment_timing endpoint (session auth). Shows, per
 * rate calculation, how long each phase took and how long the live courier API
 * fan-out took — useful to diagnose a slow booking.
 */
export interface TimingPhase {
  phase: string;
  total_ms: number;
  courier_fanout_ms?: number | null;
  couriers_queried?: number | null;
  couriers_responded?: number | null;
  services_count?: number | null;
  timestamp?: string;
}

export interface ShipmentTiming {
  shipment_id: number;
  phases: TimingPhase[];
  total_ms: number;
  captured_at: string | null;
  count: number;
}

export interface ShipmentTimingResponse {
  success: boolean;
  data?: ShipmentTiming;
  error?: string;
}

export const timingService = {
  /** GET /shipment_timing?shipment_id=N */
  get(shipment_id: number): Promise<ShipmentTimingResponse> {
    return http<ShipmentTimingResponse>("/shipment_timing", {
      query: { shipment_id },
    });
  },
};
