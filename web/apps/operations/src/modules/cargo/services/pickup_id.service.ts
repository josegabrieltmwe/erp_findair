import { http } from "./http";
import type { ApiEnvelope } from "./api.types";

/**
 * Pickup id existence + active-state check.
 *
 * Wraps api_pickup_id_check → Web_Pickup_Id_Check_Controller. Replaces
 * the legacy gest_presa_id_ajax.php which printed "OK|{field}" or
 * "KO|{field}". The boolean leak risk is minimal (a presa id either
 * exists active or not), so no per-shipment guard is enforced.
 */

export interface PickupIdCheckPayload {
  id: number;
  exists: boolean;
  stato: string | null;
  field: string;
}

export const pickupIdService = {
  /** GET api_pickup_id_check?id=N */
  check(
    id: number,
    field = "presa_id",
  ): Promise<ApiEnvelope<PickupIdCheckPayload>> {
    return http<ApiEnvelope<PickupIdCheckPayload>>("/api_pickup_id_check", {
      query: { id, field },
    });
  },
};
