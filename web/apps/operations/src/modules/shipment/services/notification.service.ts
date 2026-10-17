import { http } from "./http";

/**
 * Trigger transactional email notifications (legacy spedy_delivered_mail.php /
 * spedyc_mawb_mail.php etc.). Wraps api_notification_trigger →
 * Web_Notification_Trigger_Controller (hybrid auth) → Notification_Service.
 *
 * The `delivery` type reproduces spedy_delivered_mail.php: it emails the
 * TRKc template to the sender/office when a shipment is marked delivered.
 */
export type NotificationType =
  | "delivery"
  | "mawb_confirmation"
  | "cargo_offer"
  | "credential"
  | "agency";

export const notificationService = {
  /**
   * Send a notification for an entity (shipment/cargo id). Returns the
   * backend envelope; callers decide whether to surface a toast.
   */
  trigger(
    type: NotificationType,
    entity_id: number,
    options: Record<string, unknown> = {},
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    return http("/api_notification_trigger", {
      method: "POST",
      body: { type, entity_id, ...options },
    });
  },

  /** Email the delivery notice to the sender (legacy spedy_delivered_mail). */
  delivered(
    shipment_id: number,
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    return this.trigger("delivery", shipment_id);
  },
};
