import { http } from "./http";

/**
 * Share the courier label by email — recipients (client contacts) + send.
 * Backend: /api_courier_label_share_recipients + /api_courier_label_email.
 */

export interface LabelShareRecipient {
  id: number;
  email: string;
  name: string;
}

interface RecipientsEnvelope {
  success: boolean;
  data?: {
    shipment_id: number;
    recipients: LabelShareRecipient[];
    count: number;
  };
  error?: string;
}

interface ShareEnvelope {
  success: boolean;
  data?: { shipment_id: number; sent_to: string[] };
  message?: string;
  error?: string;
}

export const labelShareService = {
  /** Client contacts of the shipment, for the recipient autocomplete. */
  async recipients(shipmentId: number): Promise<LabelShareRecipient[]> {
    const res = await http<RecipientsEnvelope>(
      "/api_courier_label_share_recipients",
      { query: { shipment_id: shipmentId } },
    );
    return res?.data?.recipients ?? [];
  },

  /** Send the chosen document PDF to the recipients (+ optional CC). */
  send(
    shipmentId: number,
    recipients: string[],
    cc: string[] = [],
    docType: "ldv" | "courier_label" = "ldv",
  ): Promise<ShareEnvelope> {
    return http<ShareEnvelope>("/api_courier_label_email", {
      method: "POST",
      body: {
        shipment_id: shipmentId,
        recipients,
        cc,
        doc_type: docType,
      },
    });
  },
};
