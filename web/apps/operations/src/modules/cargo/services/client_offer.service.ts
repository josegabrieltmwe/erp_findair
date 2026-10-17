import { http } from "./http";

/**
 * Client-offer service (CRGOFF / offer TO the client) — distinct from
 * cargo_offers.service.ts (RFQ to airlines). Talks to /api_cargo_client_offer.
 */

export interface ClientOfferContact {
  id: number;
  name: string;
  email: string;
  lingua_web: string;
  offerte_mail: string;
}

interface ContactsResponse {
  success: boolean;
  data?: { cargo_id: number; contacts: ClientOfferContact[]; count: number };
  error?: string;
}

interface MutationResponse {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

const BASE = "/api_cargo_client_offer";

export const clientOfferService = {
  /** GET eligible client contacts (offerte_mail != 'N'). */
  contacts(cargo_id: number): Promise<ContactsResponse> {
    return http<ContactsResponse>(BASE, { query: { cargo_id } });
  },

  /** Send the CRGOFF quotation email to the client's contacts (+ optional
   *  manual recipients / CC). */
  send(
    cargo_id: number,
    contact_ids: number[],
    extraEmails: string[] = [],
    cc: string[] = [],
    bodyHtml?: string,
  ): Promise<MutationResponse> {
    const body: Record<string, unknown> = {
      action: "send",
      cargo_id,
      contact_ids,
    };
    if (extraEmails.length) body.extra_emails = extraEmails;
    if (cc.length) body.cc = cc;
    if (bodyHtml != null && bodyHtml !== "") body.body_html = bodyHtml;
    return http<MutationResponse>(BASE, { method: "POST", body });
  },

  /** Record the client's decision: N=new, V=viewed, A=accepted, R=refused. */
  setStatus(
    cargo_id: number,
    offerta: "N" | "V" | "A" | "R",
  ): Promise<MutationResponse> {
    return http<MutationResponse>(BASE, {
      method: "POST",
      body: { action: "status", cargo_id, offerta },
    });
  },

  /** Persist the free-text offer description. */
  setText(cargo_id: number, offerta_txt: string): Promise<MutationResponse> {
    return http<MutationResponse>(BASE, {
      method: "POST",
      body: { action: "text", cargo_id, offerta_txt },
    });
  },
};
