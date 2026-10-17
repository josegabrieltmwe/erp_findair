import { http } from "./http";

export interface SendLdvToMittenteResponse {
  success: boolean;
  sent_to?: string;
  sent_at?: string;
  error?: string;
}

export const ldvService = {
  /** ajax_send_ldv_to_mittente — emails the LDV PDF to the shipment sender. */
  sendToMittente(
    shipment_id: number,
    otp = "",
  ): Promise<SendLdvToMittenteResponse> {
    return http<SendLdvToMittenteResponse>("/ajax_send_ldv_to_mittente", {
      query: { shipment_id, otp },
    });
  },
};
