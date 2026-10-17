import { http } from "./http";

/**
 * Courier RFQ service (request a quote from couriers by email) — the courier
 * counterpart of cargo_offers.service.ts. Talks to /api_express_offers.
 */

export interface ExpressOffer {
  id: number;
  id_spedizione: number;
  id_courier: number;
  courier_nome?: string | null;
  costo?: number | string | null;
  change_valuta?: string | null;
  data_rich?: string | null;
  data_risp?: string | null;
  txt_richiesta?: string | null;
  txt_risposta?: string | null;
  txt_schedule?: string | null;
  accettata?: "S" | "N" | string;
  controllata?: "S" | "N" | string;
  valutazione?: string | null;
  [k: string]: unknown;
}

interface ListEnvelope {
  success: boolean;
  data?: { shipment_id: number; offers: ExpressOffer[]; count: number };
  error?: string;
}

interface DistributeEnvelope {
  success: boolean;
  data?: { shipment_id: number; sent: number; errors: string[] };
  details?: { errors?: string[] };
  message?: string;
  error?: string;
}

interface MutationEnvelope {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface AcceptEnvelope {
  success: boolean;
  data?: {
    id: number;
    shipment_id: number;
    cost_applied?: boolean;
    cost_cleared?: boolean;
    cost_warning: string | null;
    awb_canceled?: boolean;
    awb_warning?: string | null;
  };
  message?: string;
  error?: string;
}

const BASE = "/api_express_offers";

export const expressOffersService = {
  /** GET the RFQs already sent for a shipment. */
  async list(shipmentId: number): Promise<ExpressOffer[]> {
    const res = await http<ListEnvelope>(BASE, {
      query: { shipment_id: shipmentId },
    });
    return res?.data?.offers ?? [];
  },

  /** POST distribute: fan out the RFQ email to the selected couriers. */
  distribute(
    shipmentId: number,
    courierIds: number[],
    rfqText: string,
    fileIds: number[] = [],
    extraEmails: string[] = [],
    cc: string[] = [],
    bodyHtml?: string,
  ): Promise<DistributeEnvelope> {
    const body: Record<string, unknown> = {
      action: "distribute",
      shipment_id: shipmentId,
      carriers: courierIds,
      rfq_text: rfqText,
      file_ids: fileIds,
    };
    if (extraEmails.length) body.extra_emails = extraEmails;
    if (cc.length) body.cc = cc;
    if (bodyHtml != null && bodyHtml !== "") body.body_html = bodyHtml;
    return http<DistributeEnvelope>(BASE, { method: "POST", body });
  },

  /** PUT: operator update of an offer (record reply, accept, rate). */
  update(
    offerId: number,
    patch: Partial<ExpressOffer>,
  ): Promise<MutationEnvelope> {
    return http<MutationEnvelope>(BASE, {
      method: "PUT",
      body: { id: offerId, ...patch },
    });
  },

  /**
   * POST accept: elige esta oferta como ganadora del RFQ. El backend la marca
   * accettata='S', desmarca las demás (exclusividad) y vuelca su precio a la
   * expedición (costo_previsto/change_valuta/id_fornitore), respetando los locks
   * de precio/facturación. `cost_applied=false` + `cost_warning` si el envío
   * estaba bloqueado (la oferta queda aceptada igualmente).
   */
  accept(offerId: number): Promise<AcceptEnvelope> {
    return http<AcceptEnvelope>(BASE, {
      method: "POST",
      body: { action: "accept", id: offerId },
    });
  },

  /** DELETE: soft-delete an offer. */
  remove(offerId: number): Promise<MutationEnvelope> {
    return http<MutationEnvelope>(BASE, {
      method: "DELETE",
      query: { id: offerId },
    });
  },

  /**
   * POST notify_winner: envía el email de ADJUDICACIÓN al courier ganador (tipo
   * EXPWIN). `bodyHtml` opcional = cuerpo editado en el WYSIWYG.
   */
  notifyWinner(
    offerId: number,
    lang: string,
    bodyHtml?: string,
    extraEmails: string[] = [],
    cc: string[] = [],
  ): Promise<MutationEnvelope> {
    const body: Record<string, unknown> = {
      action: "notify_winner",
      id: offerId,
      lang,
    };
    if (bodyHtml != null && bodyHtml !== "") body.body_html = bodyHtml;
    if (extraEmails.length) body.extra_emails = extraEmails;
    if (cc.length) body.cc = cc;
    return http<MutationEnvelope>(BASE, { method: "POST", body });
  },

  /** POST reset: cancela la selección (desmarca ganadora, limpia proveedor/coste). */
  reset(offerId: number): Promise<AcceptEnvelope> {
    return http<AcceptEnvelope>(BASE, {
      method: "POST",
      body: { action: "reset", id: offerId },
    });
  },
};
