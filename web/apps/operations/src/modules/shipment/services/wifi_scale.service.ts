/**
 * WiFi-scale (operator weighing tablet) REST client.
 *
 * Backend: tmwe_json\controller\web\courier\scale\Web_Wifi_Scale_Controller
 * Endpoint: /api_shipment_wifi_scale?op=find|apply|recent
 *
 * Legacy reference: spedy_pesi_wifi_collo_ajax.php (resolve collo) +
 * spedy_pesi_wifi_ajax.php (apply reading). The modern endpoint
 * multiplexes both ops on `?op=…` and adds an extra `recent` op that
 * the dialog uses to surface a "lecturas recientes" panel without
 * polling the entire shipment.
 */
import { http } from "./http";

export interface WifiFindResult {
  found: boolean;
  collo_id?: number;
  shipment_id?: number;
  kind?: string;
  pesata?: boolean;
  peso?: number;
  dim_a?: number;
  dim_l?: number;
  dim_p?: number;
}

export interface WifiApplyRequest {
  shipment_id: number;
  collo_id: number;
  peso: number;
  dim_a: number;
  dim_l: number;
  dim_p: number;
}

export interface WifiApplyResult {
  success: boolean;
  collo_id: number;
  shipment_id: number;
  error?: string;
}

export interface WifiRecentItem {
  collo_id: number;
  n_collo: string;
  peso: number;
  data_pesatura: string;
}

export interface WifiRecentResponse {
  shipment_id: number;
  items: WifiRecentItem[];
}

const BASE = "/api_shipment_wifi_scale";

export const wifiScaleService = {
  /** GET ?op=find&needle=X — resolve a collo by barcode/segnacollo/RIF. */
  find(needle: string): Promise<WifiFindResult> {
    return http<WifiFindResult>(BASE, { query: { op: "find", needle } });
  },

  /** POST ?op=apply — apply the weighing measurement. */
  apply(body: WifiApplyRequest): Promise<WifiApplyResult> {
    return http<WifiApplyResult>(BASE, {
      method: "POST",
      query: { op: "apply" },
      body,
    });
  },

  /** GET ?op=recent&shipment_id=N — last N weighed colli for the shipment. */
  recent(shipment_id: number): Promise<WifiRecentResponse> {
    return http<WifiRecentResponse>(BASE, {
      query: { op: "recent", shipment_id },
    });
  },
};
