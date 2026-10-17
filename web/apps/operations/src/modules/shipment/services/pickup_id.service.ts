import { http } from "./http";

/**
 * Pickup id existence + active-state check.
 *
 * Wraps api_pickup_id_check → Web_Pickup_Id_Check_Controller. Replaces
 * the legacy gest_presa_id_ajax.php which printed "OK|{field}" or
 * "KO|{field}" for axLoaderScript to eval(). The boolean leak risk is
 * minimal (a presa id either exists active or not), so no per-shipment
 * guard is enforced server-side.
 */
export interface PickupIdCheckPayload {
  id: number;
  exists: boolean;
  stato: string | null;
  field: string;
}

interface PickupIdEnvelope {
  success: boolean;
  data?: PickupIdCheckPayload;
}

export const pickupIdService = {
  /** GET api_pickup_id_check?id=N — resolves to the inner payload. */
  async check(
    id: number,
    field = "presa_id",
  ): Promise<PickupIdCheckPayload | null> {
    const r = await http<PickupIdEnvelope>("/api_pickup_id_check", {
      query: { id, field },
    });
    return r.data ?? null;
  },
};
