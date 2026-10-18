import { http } from "./http";

export interface PartnerCurrencyResponse {
  success: boolean;
  found: boolean;
  sigla: string;
  name: string;
  id_client: number;
  id_titolare: number;
  context: string;
  error?: string;
}

export const partnerCurrencyService = {
  /** ajax_partner_currency — resolve target currency of a client's partner-titolare. */
  resolve(id_client: number, context = ""): Promise<PartnerCurrencyResponse> {
    return http<PartnerCurrencyResponse>("/api_partner_currency_compat", {
      query: { id_client, context },
    });
  },
};
