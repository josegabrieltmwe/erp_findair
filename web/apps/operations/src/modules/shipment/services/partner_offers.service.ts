import { http } from "./http";

/** Modo de envío a partner: cotizar (con OTP) o solo informar. */
export type PartnerOfferMode = "Q" | "I";

/** Una fila de envío a partner (spedizioni_off con dest_tipo='P'). */
export interface PartnerOffer {
  id: number;
  id_courier: number; // id de la anagrafica del partner destinatario
  partner_nome?: string; // razón social del partner (resuelta en backend)
  dest_tipo: string;
  modo: PartnerOfferMode;
  data_rich: string | null;
  data_risp: string | null;
  costo: number | null;
  change_valuta: string | null;
  accettata: string | null;
  otp: string | null;
}

interface ListEnvelope {
  success?: boolean;
  data?: { offers: PartnerOffer[]; count: number };
}
interface DistributeEnvelope {
  success?: boolean;
  data?: { sent: number; errors: string[] };
  message?: string;
}
interface AcceptEnvelope {
  success?: boolean;
  data?: { id: number; shipment_id: number };
  error?: string;
}

/** Email real renderizado (WYSIWYG) devuelto por la acción preview. */
export interface PartnerOfferPreview {
  subject: string;
  body: string;
  from: string;
  lang: string;
  tipo: string;
}
interface PreviewEnvelope {
  success?: boolean;
  data?: PartnerOfferPreview;
  error?: string;
  message?: string;
}

const BASE = "/api_partner_offers";

export const partnerOffersService = {
  /** GET los envíos a partner ya realizados para una expedición. */
  async list(shipmentId: number): Promise<PartnerOffer[]> {
    const res = await http<ListEnvelope>(BASE, {
      query: { shipment_id: shipmentId },
    });
    return res?.data?.offers ?? [];
  },

  /**
   * POST preview: renderiza el email REAL (con placeholders sustituidos) que
   * recibiría el partner, según modo (EXPQUOT/PARTINFO) e idioma. NO crea la
   * oferta. Alimenta el WYSIWYG del modal.
   */
  async preview(
    shipmentId: number,
    mode: PartnerOfferMode,
    text: string,
    lang: string,
    partnerId = 0,
  ): Promise<PartnerOfferPreview | null> {
    const res = await http<PreviewEnvelope>(BASE, {
      method: "POST",
      body: {
        action: "preview",
        shipment_id: shipmentId,
        mode,
        text,
        lang,
        partner_id: partnerId,
      },
    });
    return res?.success && res.data ? res.data : null;
  },

  /**
   * POST distribute: envía la expedición a los partners seleccionados.
   * `bodyHtml` (opcional) = cuerpo editado por el operador en el WYSIWYG; si se
   * envía, sustituye al template resuelto (sanitizado en backend).
   */
  distribute(
    shipmentId: number,
    partnerIds: number[],
    mode: PartnerOfferMode,
    text: string,
    fileIds: number[] = [],
    bodyHtml?: string,
    extraEmails: string[] = [],
    cc: string[] = [],
  ): Promise<DistributeEnvelope> {
    const body: Record<string, unknown> = {
      action: "distribute",
      shipment_id: shipmentId,
      partners: partnerIds,
      mode,
      text,
      file_ids: fileIds,
    };
    if (bodyHtml != null && bodyHtml !== "") body.body_html = bodyHtml;
    if (extraEmails.length) body.extra_emails = extraEmails;
    if (cc.length) body.cc = cc;
    return http<DistributeEnvelope>(BASE, { method: "POST", body });
  },

  /**
   * POST accept: elige esta oferta de partner como ganadora (marca ganadora,
   * desmarca las demás). No vuelca coste a la expedición (un partner no es el
   * fornitore courier).
   */
  accept(offerId: number): Promise<AcceptEnvelope> {
    return http<AcceptEnvelope>(BASE, {
      method: "POST",
      body: { action: "accept", id: offerId },
    });
  },
};
