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
    // El backend solo acepta POST (405 con GET) y el BFF solo publica
    // post.api_send_ldv_to_mittente_compat: parametros en el body.
    return http<SendLdvToMittenteResponse>("/api_send_ldv_to_mittente_compat", {
      method: "POST",
      body: { shipment_id, otp },
    });
  },
};
