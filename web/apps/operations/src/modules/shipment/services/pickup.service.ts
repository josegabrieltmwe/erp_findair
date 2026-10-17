import { http } from "./http";

/**
 * Courier pickup actions on a shipment (cancel / reserve), backed by the
 * Web_* hybrid controllers (session cookie). The backend routes the real
 * carrier op through the RabbitMQ worker and enforces both authorization
 * layers (pickups:write + ownership). The SPA only triggers; it never talks
 * to a carrier directly.
 *
 * Flow rule (see ShipmentPickupScheduleBox): reserving a pickup on an
 * already-labelled shipment requires explicit confirmation — the service
 * sends confirm=true only after the user confirms the alert dialog.
 */
export interface PickupActionResponse {
  success: boolean;
  data?: { shipment_id: number; pickup_code?: string };
  error?: string;
  error_code?: string;
}

export const pickupService = {
  /** `cancel_pickup` — cancel the courier pickup of a shipment. */
  cancel(shipment_id: number): Promise<PickupActionResponse> {
    return http<PickupActionResponse>("/cancel_pickup", {
      query: { shipment_id },
    });
  },

  /**
   * `reserve_pickup` — book the courier pickup of a labelled shipment.
   * `confirm` MUST be true (the controller returns 428 otherwise); the SPA
   * passes it only after the user confirms the "steps to follow" alert.
   * Triggers a real courier booking.
   */
  reserve(
    shipment_id: number,
    confirm: boolean,
  ): Promise<PickupActionResponse> {
    return http<PickupActionResponse>("/reserve_pickup", {
      method: "POST",
      body: { shipment_id, confirm },
    });
  },
};
