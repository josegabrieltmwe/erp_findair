/**
 * AWB lifecycle helpers (reset, etc.).
 *
 * Backend: tmwe_json\controller\web\courier\shipment\Web_Reset_Shipment_Awb_Controller
 *
 * Replicates the legacy `spedy_resetawb.php` behaviour: moves the
 * current `AWB_forn` value into `AWB_form_old` history and clears the
 * current field so the operator can request a fresh label from the
 * carrier without re-creating the shipment.
 */
import { http } from "./http";

export interface ResetAwbResponse {
  success: boolean;
  data?: {
    shipment_id: number;
    awb_cleared: string;
    history: string;
  };
  error?: string;
  message?: string;
}

export const awbService = {
  /**
   * POST /reset_shipment_awb — body `{shipment_id}`.
   */
  reset(shipment_id: number): Promise<ResetAwbResponse> {
    return http<ResetAwbResponse>("/reset_shipment_awb", {
      method: "POST",
      body: { shipment_id },
    });
  },
};
